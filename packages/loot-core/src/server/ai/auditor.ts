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
import type { AuditRulesOutcome } from '#types/models/ai';

import { classifyTransactionForReview } from './classify';
import { getAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';
import {
  getPendingRuleHits,
  parseRuleSampleTransactionIds,
  recordRuleSampleHits,
  resolveRuleHit,
} from './rule-hits';
import { getSpendTodayUsd, recordRun } from './runs';

const MAX_PENDING_HITS_PER_RULE = 100;

type ApprovedRule = {
  id: string;
  ruleId: string | null;
  op: string;
  value: string;
  categoryId: string;
  rationale: string;
  sampleTransactionIds: string;
  hits: number;
  confirmed: number;
  corrected: number;
};

type RuleAuditSummary = {
  pending: number;
  audited: number;
  confirmed: number;
  corrected: number;
  skipped: number;
  failed: number;
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

/** Mirrors the supported string operators and remains exported for rule
 * proposal validation and focused tests. Auditing itself consumes hits
 * recorded by the real rule engine. */
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
): Promise<RuleAuditSummary> {
  if (rule.ruleId) {
    await recordRuleSampleHits({
      ruleId: rule.ruleId,
      transactionIds: parseRuleSampleTransactionIds(rule.sampleTransactionIds),
      categoryId: rule.categoryId,
    });
  }

  const hits = await getPendingRuleHits(rule.id, MAX_PENDING_HITS_PER_RULE);
  if (hits.length === 0) {
    return {
      pending: 0,
      audited: 0,
      confirmed: 0,
      corrected: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const rate = computeSampleRate(rule.hits, rule.confirmed);
  const sampleSize = Math.max(1, Math.round(hits.length * rate));
  const sample = hits.slice(0, sampleSize);
  const skippedHits = hits.slice(sampleSize);
  await Promise.all(
    skippedHits.map(hit =>
      resolveRuleHit({
        hitId: hit.hitId,
        status: 'skipped',
        rationale: `Not selected by the ${Math.round(rate * 100)}% audit sample.`,
      }),
    ),
  );

  const categoryName = categoryNames.get(rule.categoryId) ?? rule.categoryId;
  const providerConfig = await buildProviderConfigForTier(auditorAgent.tier);

  let audited = 0;
  let confirmed = 0;
  let corrected = 0;
  let failed = 0;

  for (const transaction of sample) {
    try {
      const result = await runWorkflow(
        auditorAgent,
        {
          payeeName: transaction.payeeName ?? transaction.importedPayee ?? '',
          amountCents: transaction.amount,
          notes: transaction.notes ?? undefined,
          appliedCategoryName: categoryName,
          ruleRationale: rule.rationale,
        },
        { config: providerConfig },
      );
      await recordRun(result.run);
      audited++;
      if (result.output.verdict === 'correct') {
        confirmed++;
        await resolveRuleHit({
          hitId: transaction.hitId,
          status: 'confirmed',
          rationale: result.output.rationale,
        });
      }
      if (result.output.verdict === 'incorrect') {
        corrected++;
        await resolveRuleHit({
          hitId: transaction.hitId,
          status: 'corrected',
          rationale: result.output.rationale,
        });
        await classifyTransactionForReview(transaction.transactionId);
      }
    } catch (error) {
      if (error instanceof WorkflowError) {
        await recordRun(error.run);
      }
      failed++;
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

  return {
    pending: hits.length,
    audited,
    confirmed,
    corrected,
    skipped: skippedHits.length,
    failed,
  };
}

/** Runs an audit sampling pass over recorded hits for every approved mined
 * rule. It is safe to trigger after sync because only still-pending hits are
 * considered and the adaptive sampling rate limits mature rules. */
export async function auditApprovedRules(): Promise<AuditRulesOutcome> {
  const config = getAiConfig();
  if (!config.enabled) return { status: 'disabled' };

  try {
    assertCanStartRun(
      { maxCostPerDayUsd: config.maxCostPerDayUsd },
      await getSpendTodayUsd(),
    );
  } catch (error) {
    logger.warn('Rule audit skipped (budget):', error);
    return { status: 'budget-exceeded' };
  }

  const { data: approvedRules } = await aqlQuery(
    q('ai_rule_meta')
      .filter({ status: 'approved' })
      .select([
        'id',
        { ruleId: 'rule_id' },
        'op',
        'value',
        { categoryId: 'category_id' },
        'rationale',
        { sampleTransactionIds: 'sample_transaction_ids' },
        'hits',
        'confirmed',
        'corrected',
      ]),
  );

  if ((approvedRules as ApprovedRule[]).length === 0) {
    return { status: 'no-pending' };
  }

  const categoryNames = await fetchCategoryNames();
  const total: RuleAuditSummary = {
    pending: 0,
    audited: 0,
    confirmed: 0,
    corrected: 0,
    skipped: 0,
    failed: 0,
  };
  for (const rule of approvedRules as ApprovedRule[]) {
    const summary = await auditRule(rule, categoryNames);
    total.pending += summary.pending;
    total.audited += summary.audited;
    total.confirmed += summary.confirmed;
    total.corrected += summary.corrected;
    total.skipped += summary.skipped;
    total.failed += summary.failed;
  }

  return total.pending === 0
    ? { status: 'no-pending' }
    : {
        status: 'ok',
        audited: total.audited,
        confirmed: total.confirmed,
        corrected: total.corrected,
        skipped: total.skipped,
        failed: total.failed,
      };
}
