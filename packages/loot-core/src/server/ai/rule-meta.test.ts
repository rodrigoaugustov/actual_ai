import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { getRules, loadRules } from '#server/transactions/transaction-rules';

import {
  createRuleProposal,
  getRuleProposals,
  resolveRuleProposal,
} from './rule-meta';

beforeEach(global.emptyDatabase());

async function prepare() {
  await loadMappings();
  await loadRules();
  await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'group1',
  });
}

describe('createRuleProposal / getRuleProposals', () => {
  it('lists only proposed rules with sample transaction ids parsed back to an array', async () => {
    await prepare();
    await createRuleProposal({
      proposal: {
        payeeName: 'Extra',
        op: 'contains',
        value: 'EXTRA',
        categoryId: 'groceries',
        rationale: 'Consistent across samples',
        confidence: 0.9,
      },
      sampleTransactionIds: ['t1', 't2'],
    });

    const proposals = await getRuleProposals();
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      payeeName: 'Extra',
      op: 'contains',
      value: 'EXTRA',
      categoryId: 'groceries',
      status: 'proposed',
    });
    expect(proposals[0].sampleTransactionIds).toEqual(['t1', 't2']);
  });
});

describe('resolveRuleProposal', () => {
  it('approve creates a real rule matching imported_payee and marks the proposal approved', async () => {
    await prepare();
    await db.insertAccount({ id: 'checking', name: 'Checking' });
    const payeeId = await db.insertPayee({ name: 'Extra' });
    await db.insertTransaction({
      id: 'txn1',
      account: 'checking',
      payee: payeeId,
      category: 'groceries',
      imported_payee: 'EXTRA SUPERMERCADOS',
      amount: -1000,
      date: '2026-01-05',
    });
    const id = await createRuleProposal({
      proposal: {
        payeeName: 'Extra',
        op: 'contains',
        value: 'EXTRA',
        categoryId: 'groceries',
        rationale: 'x',
        confidence: 0.9,
      },
      sampleTransactionIds: ['txn1'],
    });

    await resolveRuleProposal({ id, action: 'approve' });

    expect(await getRuleProposals()).toHaveLength(0);
    const rules = getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].conditions).toMatchObject([
      { field: 'imported_payee', op: 'contains', rawValue: 'EXTRA' },
    ]);
    expect(rules[0].actions).toMatchObject([
      { field: 'category', op: 'set', value: 'groceries' },
    ]);
    expect(
      await db.first<{
        transactionId: string;
        categoryId: string;
        status: string;
      }>(
        `SELECT transaction_id AS transactionId,
                category_id AS categoryId,
                status
           FROM ai_rule_hits`,
      ),
    ).toEqual({
      transactionId: 'txn1',
      categoryId: 'groceries',
      status: 'pending',
    });
  });

  it('approve splits a comma-joined oneOf value into an array condition', async () => {
    await prepare();
    const id = await createRuleProposal({
      proposal: {
        payeeName: 'Uber',
        op: 'oneOf',
        value: 'UBER *TRIP, UBER *EATS',
        categoryId: 'groceries',
        rationale: 'x',
        confidence: 0.9,
      },
      sampleTransactionIds: [],
    });

    await resolveRuleProposal({ id, action: 'approve' });

    const rules = getRules();
    expect(rules[0].conditions[0]).toMatchObject({
      op: 'oneOf',
      rawValue: ['UBER *TRIP', 'UBER *EATS'],
    });
  });

  it('reject marks the proposal rejected without creating a rule', async () => {
    await prepare();
    const id = await createRuleProposal({
      proposal: {
        payeeName: 'Extra',
        op: 'contains',
        value: 'EXTRA',
        categoryId: 'groceries',
        rationale: 'x',
        confidence: 0.9,
      },
      sampleTransactionIds: [],
    });

    await resolveRuleProposal({ id, action: 'reject' });

    expect(await getRuleProposals()).toHaveLength(0);
    expect(getRules()).toHaveLength(0);
  });
});
