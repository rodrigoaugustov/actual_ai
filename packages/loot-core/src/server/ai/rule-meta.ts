import type { RuleProposal } from '@actual-app/ai';

import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { insertRule } from '#server/transactions/transaction-rules';
import { q } from '#shared/query';
import type {
  AiRuleMetaEntity,
  AiRuleSampleTransaction,
} from '#types/models/ai';

import {
  parseRuleSampleTransactionIds,
  recordRuleSampleHits,
} from './rule-hits';

export async function createRuleProposal(params: {
  proposal: RuleProposal;
  sampleTransactionIds: string[];
  runId?: string;
}): Promise<string> {
  return db.insertWithUUID('ai_rule_meta', {
    rule_id: null,
    payee_name: params.proposal.payeeName,
    op: params.proposal.op,
    value: params.proposal.value,
    category_id: params.proposal.categoryId,
    rationale: params.proposal.rationale,
    confidence: params.proposal.confidence,
    sample_transaction_ids: JSON.stringify(params.sampleTransactionIds),
    status: 'proposed',
    hits: 0,
    confirmed: 0,
    corrected: 0,
    run_id: params.runId ?? null,
    created_at: Date.now(),
    tombstone: 0,
  });
}

const RULE_META_SELECT = [
  'id',
  { ruleId: 'rule_id' },
  { payeeName: 'payee_name' },
  'op',
  'value',
  { categoryId: 'category_id' },
  'rationale',
  'confidence',
  { sampleTransactionIds: 'sample_transaction_ids' },
  'status',
  'hits',
  'confirmed',
  'corrected',
  { runId: 'run_id' },
  { createdAt: 'created_at' },
] as const;

/** Payees that already have a proposal awaiting user review — the miner
 * must analyze these before proposing anything new for them, instead of
 * piling on a second proposal while the first is still pending. */
export async function getPendingProposalPayees(): Promise<Set<string>> {
  const rows = await db.all<{ payeeName: string }>(
    `SELECT DISTINCT payee_name AS payeeName
       FROM ai_rule_meta
      WHERE status = 'proposed' AND tombstone = 0`,
  );
  return new Set(rows.map(row => row.payeeName.toLowerCase()));
}

/** Exact (payee, category) pairs the user has already rejected as a mined
 * proposal — keyed as `payeeName.toLowerCase()::categoryId` — so that exact
 * pair is never proposed again, regardless of how the model phrases it. */
export async function getRejectedProposalKeys(): Promise<Set<string>> {
  const rows = await db.all<{ payeeName: string; categoryId: string }>(
    `SELECT DISTINCT payee_name AS payeeName, category_id AS categoryId
       FROM ai_rule_meta
      WHERE status = 'rejected' AND tombstone = 0`,
  );
  return new Set(
    rows.map(row => `${row.payeeName.toLowerCase()}::${row.categoryId}`),
  );
}

/** Total rejection count per payee, across every category it was ever
 * rejected for. A payee rejected repeatedly (even for different proposed
 * categories) is dropped as a candidate entirely rather than reproposed
 * forever. */
export async function getRejectedProposalPayeeCounts(): Promise<
  Map<string, number>
> {
  const rows = await db.all<{ payeeName: string; count: number }>(
    `SELECT payee_name AS payeeName, COUNT(*) AS count
       FROM ai_rule_meta
      WHERE status = 'rejected' AND tombstone = 0
      GROUP BY payee_name`,
  );
  return new Map(rows.map(row => [row.payeeName.toLowerCase(), row.count]));
}

function parseRuleMetaRows(
  data: Array<
    Omit<AiRuleMetaEntity, 'sampleTransactionIds'> & {
      sampleTransactionIds: string;
    }
  >,
): AiRuleMetaEntity[] {
  return data.map(row => ({
    ...row,
    sampleTransactionIds: parseRuleSampleTransactionIds(
      row.sampleTransactionIds,
    ),
  }));
}

export async function getRuleProposals(): Promise<AiRuleMetaEntity[]> {
  const { data } = await aqlQuery(
    q('ai_rule_meta')
      .filter({ status: 'proposed' })
      .select([...RULE_META_SELECT])
      .orderBy({ created_at: 'desc' }),
  );
  const proposals = parseRuleMetaRows(data);
  const sampleIds = [
    ...new Set(proposals.flatMap(proposal => proposal.sampleTransactionIds)),
  ];
  if (sampleIds.length === 0) {
    return proposals.map(proposal => ({
      ...proposal,
      sampleTransactions: [],
    }));
  }

  const { data: sampleData } = await aqlQuery(
    q('transactions')
      .filter({ id: { $oneof: sampleIds } })
      .select([
        'id',
        'date',
        'amount',
        { payeeName: 'payee.name' },
        { importedPayee: 'imported_payee' },
        { accountName: 'account.name' },
      ]),
  );
  const samplesById = new Map(
    (sampleData as AiRuleSampleTransaction[]).map(sample => [
      sample.id,
      sample,
    ]),
  );
  return proposals.map(proposal => ({
    ...proposal,
    sampleTransactions: proposal.sampleTransactionIds.flatMap(id => {
      const sample = samplesById.get(id);
      return sample ? [sample] : [];
    }),
  }));
}

/** Approved rules with their audit track record, for the rule-health panel. */
export async function getRuleHealth(): Promise<AiRuleMetaEntity[]> {
  const { data } = await aqlQuery(
    q('ai_rule_meta')
      .filter({ status: 'approved' })
      .select([...RULE_META_SELECT])
      .orderBy({ created_at: 'desc' }),
  );
  const rules = parseRuleMetaRows(data);
  if (rules.length === 0) return rules;

  const falsePositives = await db.all<{
    ruleMetaId: string;
    transactionId: string;
    payeeName: string | null;
    rationale: string | null;
    auditedAt: number | null;
  }>(
    `WITH ranked_hits AS (
       SELECT h.*,
              ROW_NUMBER() OVER (
                PARTITION BY h.rule_meta_id
                ORDER BY h.audited_at DESC
              ) AS position
         FROM ai_rule_hits h
        WHERE h.status = 'corrected' AND h.tombstone = 0
     )
     SELECT h.rule_meta_id AS ruleMetaId,
            h.transaction_id AS transactionId,
            p.name AS payeeName,
            h.rationale,
            h.audited_at AS auditedAt
       FROM ranked_hits h
       LEFT JOIN transactions t ON t.id = h.transaction_id
       LEFT JOIN payees p ON p.id = t.description
      WHERE h.position <= 3
      ORDER BY h.audited_at DESC`,
  );
  const byRule = new Map<string, AiRuleMetaEntity['recentFalsePositives']>();
  for (const falsePositive of falsePositives) {
    const current = byRule.get(falsePositive.ruleMetaId) ?? [];
    if (current.length < 3) {
      current.push(falsePositive);
      byRule.set(falsePositive.ruleMetaId, current);
    }
  }
  return rules.map(rule => ({
    ...rule,
    recentFalsePositives: byRule.get(rule.id) ?? [],
  }));
}

export async function resolveRuleProposal({
  id,
  action,
}: {
  id: string;
  action: 'approve' | 'reject';
}): Promise<void> {
  const {
    data: [proposal],
  } = await aqlQuery(q('ai_rule_meta').filter({ id }).select('*'));
  if (!proposal) return;

  if (action === 'reject') {
    await db.update('ai_rule_meta', { id, status: 'rejected' });
    return;
  }

  const value =
    proposal.op === 'oneOf'
      ? (proposal.value as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : proposal.value;

  const ruleId = await insertRule({
    stage: null,
    conditionsOp: 'and',
    conditions: [
      {
        field: 'imported_payee',
        op: proposal.op,
        value,
        type: 'string',
      },
    ],
    actions: [{ field: 'category', op: 'set', value: proposal.category_id }],
  });

  await db.update('ai_rule_meta', { id, status: 'approved', rule_id: ruleId });
  await recordRuleSampleHits({
    ruleId,
    transactionIds: parseRuleSampleTransactionIds(
      proposal.sample_transaction_ids as string,
    ),
    categoryId: proposal.category_id as string,
  });
}
