import type { RuleProposal } from '@actual-app/ai';

import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { insertRule } from '#server/transactions/transaction-rules';
import { q } from '#shared/query';
import type { AiRuleMetaEntity } from '#types/models/ai';

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
  { sampleTransactionIds: 'sample_transaction_ids' },
  'status',
  'hits',
  'confirmed',
  'corrected',
  { runId: 'run_id' },
  { createdAt: 'created_at' },
] as const;

function parseRuleMetaRows(
  data: Array<
    Omit<AiRuleMetaEntity, 'sampleTransactionIds'> & {
      sampleTransactionIds: string;
    }
  >,
): AiRuleMetaEntity[] {
  return data.map(row => ({
    ...row,
    sampleTransactionIds: JSON.parse(row.sampleTransactionIds || '[]'),
  }));
}

export async function getRuleProposals(): Promise<AiRuleMetaEntity[]> {
  const { data } = await aqlQuery(
    q('ai_rule_meta')
      .filter({ status: 'proposed' })
      .select([...RULE_META_SELECT])
      .orderBy({ created_at: 'desc' }),
  );
  return parseRuleMetaRows(data);
}

/** Approved rules with their audit track record, for the rule-health panel. */
export async function getRuleHealth(): Promise<AiRuleMetaEntity[]> {
  const { data } = await aqlQuery(
    q('ai_rule_meta')
      .filter({ status: 'approved' })
      .select([...RULE_META_SELECT])
      .orderBy({ created_at: 'desc' }),
  );
  return parseRuleMetaRows(data);
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
}
