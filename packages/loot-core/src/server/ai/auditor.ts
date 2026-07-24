import {
  assertCanStartRun,
  auditorAgent,
  runWorkflow,
  WorkflowError,
} from '@actual-app/ai';

import { logger } from '#platform/server/log';
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { q } from '#shared/query';

import { getAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';
import { getSpendTodayUsd, recordRun } from './runs';

const MAX_CANDIDATE_TRANSACTIONS_PER_RULE = 100;

type ApprovedRule = {
  id: string;
  op: string;
  value: string;
  categoryId: string;
  rationale: string;
  hits: number;
  confirmed: number;
  corrected: number;
};

type CandidateTransaction = {
  id: string;
  payeeName: string | null;
  amount: number;
  notes: string | null;
  imported_payee: string | null;
};

/** New rules are audited in full; the sample rate decays as observed
 * precision climbs, down to a 2% floor for rules that have proven
 * themselves. A confirmed/rejected correction resets `hits`/`confirmed` to
 * 0 implicitly by an admin re-approving, so this always reflects the
 * current track record. */
export function computeSampleRate(hits: number, confirmed: number): number {
  if (hits < 5) return 1;
  const precision = confirmed / hits;
  if (precision >= 0.98) return 0.02;
  if (precision >= 0.9) return 0.05;
  if (precision >= 0.75) return 0.2;
  return 0.5;
}

/** Actual doesn't record which rule categorized a transaction, so a hit is
 * approximated by re-applying the rule's own condition against the raw
 * bank description — good enough to find audit candidates, not meant to
 * replace the real rule engine's matching semantics. */
export function matchesRuleCondition(
  op: string,
  value: string,
  importedPayee: string | null,
): boolean {
  if (!importedPayee) return false;
  const haystack = importedPayee.toLowerCase();
  switch (op) {
    case 'contains':
      return haystack.includes(value.toLowerCase());
    case 'matches':
      try {
        return new RegExp(value, 'i').test(importedPayee);
      } catch {
        return false;
      }
    case 'oneOf':
      return value
        .split(',')
        .map(v => v.trim().toLowerCase())
        .includes(haystack);
    default:
      return false;
  }
}

async function fetchCategoryNames(): Promise<Map<string, string>> {
  const { data } = await aqlQuery(q('categories').select(['id', 'name']));
  return new Map(
    (data as Array<{ id: string; name: string }>).map(c => [c.id, c.name]),
  );
}

async function auditRule(
  rule: ApprovedRule,
  categoryNames: Map<string, string>,
): Promise<void> {
  const { data: candidates } = await aqlQuery(
    q('transactions')
      .filter({ category: rule.categoryId, transfer_id: null })
      .select([
        'id',
        { payeeName: 'payee.name' },
        'amount',
        'notes',
        'imported_payee',
      ])
      .orderBy({ date: 'desc' })
      .limit(MAX_CANDIDATE_TRANSACTIONS_PER_RULE),
  );

  const hits = (candidates as CandidateTransaction[]).filter(t =>
    matchesRuleCondition(rule.op, rule.value, t.imported_payee),
  );
  if (hits.length === 0) return;

  const rate = computeSampleRate(rule.hits, rule.confirmed);
  const sampleSize = Math.max(1, Math.round(hits.length * rate));
  const sample = hits.slice(0, sampleSize);

  const categoryName = categoryNames.get(rule.categoryId) ?? rule.categoryId;
  const providerConfig = await buildProviderConfigForTier(auditorAgent.tier);

  let audited = 0;
  let confirmed = 0;
  let corrected = 0;

  for (const transaction of sample) {
    try {
      const result = await runWorkflow(
        auditorAgent,
        {
          payeeName: transaction.payeeName ?? '',
          amountCents: transaction.amount,
          notes: transaction.notes ?? undefined,
          appliedCategoryName: categoryName,
          ruleRationale: rule.rationale,
        },
        { config: providerConfig },
      );
      await recordRun(result.run);
      audited++;
      if (result.output.verdict === 'correct') confirmed++;
      if (result.output.verdict === 'incorrect') corrected++;
    } catch (error) {
      if (error instanceof WorkflowError) {
        await recordRun(error.run);
      }
      logger.warn('Rule audit run failed:', error);
    }
  }

  if (audited > 0) {
    await db.update('ai_rule_meta', {
      id: rule.id,
      hits: rule.hits + audited,
      confirmed: rule.confirmed + confirmed,
      corrected: rule.corrected + corrected,
    });
  }
}

/** Runs an audit sampling pass over every approved, mined rule. Meant to be
 * triggered periodically (e.g. alongside rule mining), not on every sync —
 * auditing is cheap per call (tier `fast`) but still real spend. */
export async function auditApprovedRules(): Promise<void> {
  const config = getAiConfig();
  if (!config.enabled) return;

  try {
    assertCanStartRun(
      { maxCostPerDayUsd: config.maxCostPerDayUsd },
      await getSpendTodayUsd(),
    );
  } catch (error) {
    logger.warn('Rule audit skipped (budget):', error);
    return;
  }

  const { data: approvedRules } = await aqlQuery(
    q('ai_rule_meta')
      .filter({ status: 'approved' })
      .select([
        'id',
        'op',
        'value',
        { categoryId: 'category_id' },
        'rationale',
        'hits',
        'confirmed',
        'corrected',
      ]),
  );

  if ((approvedRules as ApprovedRule[]).length === 0) return;

  const categoryNames = await fetchCategoryNames();
  for (const rule of approvedRules as ApprovedRule[]) {
    await auditRule(rule, categoryNames);
  }
}
