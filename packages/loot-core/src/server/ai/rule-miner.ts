import {
  assertCanStartRun,
  ruleMinerAgent,
  runWorkflow,
  WorkflowError,
} from '@actual-app/ai';

import { logger } from '#platform/server/log';
import { aqlQuery } from '#server/aql';
import { q } from '#shared/query';
import type { MineRulesOutcome } from '#types/models/ai';

import { getAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';
import { createRuleProposal } from './rule-meta';
import { getSpendTodayUsd, recordRun } from './runs';

const MIN_SAMPLES = 3;
const MAX_TRANSACTIONS = 2000;
const MAX_CANDIDATES = 30;
const MAX_SAMPLES_PER_CANDIDATE = 5;

type PayeeGroup = {
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
 * cleaned-up payee name. */
async function fetchCandidateGroups(): Promise<Map<string, PayeeGroup>> {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ category: { $ne: null }, transfer_id: null })
      .select([
        'id',
        { categoryId: 'category' },
        { payeeName: 'payee.name' },
        'imported_payee',
      ])
      .orderBy({ date: 'desc' })
      .limit(MAX_TRANSACTIONS),
  );

  const byPayee = new Map<string, PayeeGroup>();
  for (const row of data as Array<{
    id: string;
    categoryId: string;
    payeeName: string | null;
    imported_payee: string | null;
  }>) {
    if (!row.payeeName) continue;

    let group = byPayee.get(row.payeeName);
    if (!group) {
      group = { categoryCounts: {}, samples: new Set(), ids: [] };
      byPayee.set(row.payeeName, group);
    }
    group.categoryCounts[row.categoryId] =
      (group.categoryCounts[row.categoryId] ?? 0) + 1;
    if (row.imported_payee) group.samples.add(row.imported_payee);
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
  const candidates = [...byPayee.entries()]
    .filter(([, group]) => group.ids.length >= MIN_SAMPLES)
    .slice(0, MAX_CANDIDATES)
    .map(([payeeName, group]) => ({
      payeeName,
      sampleDescriptions: [...group.samples].slice(
        0,
        MAX_SAMPLES_PER_CANDIDATE,
      ),
      categoryCounts: group.categoryCounts,
    }));

  if (candidates.length === 0) return { status: 'no-candidates' };

  const categories = await fetchCategories();
  const providerConfig = await buildProviderConfigForTier(ruleMinerAgent.tier);

  try {
    const result = await runWorkflow(
      ruleMinerAgent,
      { categories, candidates },
      { config: providerConfig },
    );
    const runId = await recordRun(result.run);

    for (const proposal of result.output.proposals) {
      const group = byPayee.get(proposal.payeeName);
      await createRuleProposal({
        proposal,
        sampleTransactionIds: group?.ids.slice(0, 5) ?? [],
        runId,
      });
    }
    return { status: 'ok', proposalsCreated: result.output.proposals.length };
  } catch (error) {
    if (error instanceof WorkflowError) {
      await recordRun(error.run);
    }
    logger.warn('Rule mining run failed:', error);
    return { status: 'run-failed' };
  }
}
