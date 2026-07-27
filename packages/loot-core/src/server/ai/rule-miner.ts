import {
  assertCanStartRun,
  ruleMinerAgent,
  runWorkflow,
  WorkflowError,
} from '@actual-app/ai';

import { logger } from '#platform/server/log';
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { q } from '#shared/query';
import type { MineRulesOutcome } from '#types/models/ai';

import { getAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';
import { getRuleMinerState, setRuleMinerState } from './miner-state';
import {
  describeExistingCategoryRules,
  partitionByExistingRuleCoverage,
} from './rule-coverage';
import {
  createRuleProposal,
  getPendingProposalPayees,
  getRejectedProposalKeys,
  getRejectedProposalPayeeCounts,
} from './rule-meta';
import { getSpendTodayUsd, recordRun } from './runs';

const MIN_SAMPLES = 3;
const MAX_TRANSACTIONS = 2000;
const MAX_CANDIDATES = 30;
const MAX_SAMPLES_PER_CANDIDATE = 5;
const MIN_NEW_FEEDBACK_TO_MINE = 5;
/** No more than one automatic mining pass every 6h, no matter how much
 * feedback accumulates in between — "Mine now" bypasses this on purpose. */
const MIN_MINING_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Proposals below this confidence are silently dropped rather than shown
 * to the user — the model itself said it wasn't sure. */
const MIN_PROPOSAL_CONFIDENCE = 0.6;
/** A payee rejected this many times (across any proposed category) is
 * dropped as a candidate entirely instead of being reproposed forever. */
const MAX_PAYEE_REJECTIONS = 2;

type PayeeGroup = {
  payeeId: string | null;
  categoryCounts: Record<string, number>;
  samples: Set<string>;
  ids: string[];
};

async function fetchCategories() {
  const { data } = await aqlQuery(
    q('categories').filter({ hidden: false }).select(['id', 'name']),
  );
  return data as Array<{ id: string; name: string }>;
}

/** Groups categorized history by the canonical payee, collecting the raw
 * bank-provided description variants seen for it — the model judges rule
 * safety from how consistent those raw variants are, not from the already
 * cleaned-up payee name.
 *
 * Only transactions with a human or AI paper trail count as evidence: a row
 * in `ai_feedback` with a final category (manual edit, or an accepted/
 * corrected suggestion), or an accepted/auto-applied `ai_suggestions` row.
 * Transactions categorized purely by an existing rule are excluded —
 * otherwise an approved mined rule (or a manual rule) becomes its own "user
 * history", which is exactly the self-reinforcing loop that kept
 * reproposing already-covered payees. */
async function fetchCandidateGroups(): Promise<Map<string, PayeeGroup>> {
  const rows = await db.all<{
    id: string;
    categoryId: string;
    payeeId: string | null;
    payeeName: string | null;
    importedPayee: string | null;
  }>(
    `SELECT t.id AS id,
            t.category AS categoryId,
            p.id AS payeeId,
            p.name AS payeeName,
            t.imported_description AS importedPayee
       FROM transactions t
       LEFT JOIN payees p ON p.id = t.description
      WHERE t.tombstone = 0
        AND t.category IS NOT NULL
        AND t.transferred_id IS NULL
        AND t.isParent = 0
        AND (
          EXISTS (
            SELECT 1 FROM ai_feedback f
             WHERE f.transaction_id = t.id AND f.tombstone = 0
               AND f.final_category_id IS NOT NULL
          )
          OR EXISTS (
            SELECT 1 FROM ai_suggestions s
             WHERE s.transaction_id = t.id AND s.tombstone = 0
               AND s.status IN ('accepted', 'auto_applied')
          )
        )
      ORDER BY t.date DESC
      LIMIT ?`,
    [MAX_TRANSACTIONS],
  );

  const byPayee = new Map<string, PayeeGroup>();
  for (const row of rows) {
    if (!row.payeeName) continue;

    let group = byPayee.get(row.payeeName);
    if (!group) {
      group = {
        payeeId: row.payeeId,
        categoryCounts: {},
        samples: new Set(),
        ids: [],
      };
      byPayee.set(row.payeeName, group);
    }
    group.categoryCounts[row.categoryId] =
      (group.categoryCounts[row.categoryId] ?? 0) + 1;
    if (row.importedPayee) group.samples.add(row.importedPayee);
    group.ids.push(row.id);
  }
  return byPayee;
}

/** Runs a rule-mining pass over categorized history, proposing candidate
 * rules for the user to review — never applies anything on its own. Meant
 * to be triggered periodically (e.g. from settings), not on every sync. */
export async function mineRuleProposals(): Promise<MineRulesOutcome> {
  const config = getAiConfig();
  if (!config.enabled) return { status: 'disabled' };

  try {
    assertCanStartRun(
      { maxCostPerDayUsd: config.maxCostPerDayUsd },
      await getSpendTodayUsd(),
    );
  } catch (error) {
    logger.warn('Rule mining skipped (budget):', error);
    return { status: 'budget-exceeded' };
  }

  const byPayee = await fetchCandidateGroups();
  const [pendingPayees, rejectedPairKeys, rejectedPayeeCounts, categories] =
    await Promise.all([
      getPendingProposalPayees(),
      getRejectedProposalKeys(),
      getRejectedProposalPayeeCounts(),
      fetchCategories(),
    ]);

  const allCandidates = [...byPayee.entries()]
    .filter(([, group]) => group.ids.length >= MIN_SAMPLES)
    .map(([payeeName, group]) => ({
      payeeName,
      payeeId: group.payeeId,
      sampleDescriptions: [...group.samples].slice(
        0,
        MAX_SAMPLES_PER_CANDIDATE,
      ),
      categoryCounts: group.categoryCounts,
    }));

  // Never repropose a payee that already has a pending proposal (analyze
  // it first) or that's already covered by an existing rule (manual or
  // previously approved) — the miner previously had no notion of either.
  const { uncovered } = partitionByExistingRuleCoverage(allCandidates);
  const eligible = uncovered.filter(candidate => {
    const key = candidate.payeeName.toLowerCase();
    if (pendingPayees.has(key)) return false;
    if ((rejectedPayeeCounts.get(key) ?? 0) >= MAX_PAYEE_REJECTIONS) {
      return false;
    }
    return true;
  });

  const candidates = eligible
    .slice(0, MAX_CANDIDATES)
    .map(({ payeeId: _payeeId, ...candidate }) => candidate);

  if (candidates.length === 0) return { status: 'no-candidates' };

  const existingRuleDescriptions = describeExistingCategoryRules(categories);
  const rejectedExamples = [...rejectedPairKeys].map(key => {
    const [payeeName, categoryId] = key.split('::');
    return { payeeName, categoryId };
  });

  const providerConfig = await buildProviderConfigForTier(ruleMinerAgent.tier);

  try {
    const result = await runWorkflow(
      ruleMinerAgent,
      { categories, candidates, rejectedExamples, existingRuleDescriptions },
      { config: providerConfig },
    );
    const runId = await recordRun(result.run);

    let proposalsCreated = 0;
    for (const proposal of result.output.proposals) {
      if (proposal.confidence < MIN_PROPOSAL_CONFIDENCE) continue;
      const pairKey = `${proposal.payeeName.toLowerCase()}::${proposal.categoryId}`;
      if (rejectedPairKeys.has(pairKey)) continue;

      const group = byPayee.get(proposal.payeeName);
      await createRuleProposal({
        proposal,
        sampleTransactionIds: group?.ids.slice(0, 5) ?? [],
        runId,
      });
      proposalsCreated++;
    }
    return { status: 'ok', proposalsCreated };
  } catch (error) {
    if (error instanceof WorkflowError) {
      await recordRun(error.run);
    }
    logger.warn('Rule mining run failed:', error);
    return { status: 'run-failed' };
  }
}

/** Starts a background mining pass only after enough new human decisions
 * have accumulated since the last attempt, and never more often than the
 * cooldown allows. The attempt timestamp is recorded *before* running, so a
 * pass that returns early (budget exceeded, no candidates, disabled, ...)
 * still resets the cooldown — otherwise the watermark would never move and
 * every subsequent feedback row would re-run the full candidate scan. */
async function mineWhenEligible(): Promise<MineRulesOutcome | null> {
  const config = getAiConfig();
  if (!config.enabled) return null;

  const state = getRuleMinerState();
  const now = Date.now();
  if (now - state.lastAttemptAt < MIN_MINING_INTERVAL_MS) return null;

  const feedback = await db.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM ai_feedback
      WHERE tombstone = 0
        AND final_category_id IS NOT NULL
        AND created_at > ?`,
    [state.lastAttemptAt],
  );
  if ((feedback?.count ?? 0) < MIN_NEW_FEEDBACK_TO_MINE) return null;

  await setRuleMinerState({ lastAttemptAt: now });
  const outcome = await mineRuleProposals();
  if (outcome.status === 'ok') {
    await setRuleMinerState({ lastAttemptAt: now, lastRunAt: now });
  }
  return outcome;
}

let pendingMiningCheck: Promise<MineRulesOutcome | null> | null = null;

/** Entry point called from every feedback event (accept/correct/reject a
 * suggestion, edit a category manually). Concurrent calls — a burst of
 * accepts working through the review inbox — share the same in-flight
 * check instead of each queuing their own; the cooldown in
 * `mineWhenEligible` bounds how often that check can actually trigger an
 * LLM call. */
export function maybeMineRuleProposals(): Promise<MineRulesOutcome | null> {
  if (!pendingMiningCheck) {
    pendingMiningCheck = mineWhenEligible().finally(() => {
      pendingMiningCheck = null;
    });
  }
  return pendingMiningCheck;
}
