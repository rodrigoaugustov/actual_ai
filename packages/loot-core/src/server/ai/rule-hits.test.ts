import * as db from '#server/db';

import { markRuleHitCorrectedByUser, recordRuleHit } from './rule-hits';

beforeEach(global.emptyDatabase());

it('records only approved AI rule hits and resets sampling after user correction', async () => {
  await db.insertAccount({ id: 'checking', name: 'Checking' });
  await db.insertPayee({ id: 'market', name: 'Market' });
  await db.insertCategoryGroup({ id: 'expenses', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'expenses',
  });
  await db.insertCategory({
    id: 'restaurants',
    name: 'Restaurants',
    cat_group: 'expenses',
  });
  await db.insertTransaction({
    id: 'txn1',
    account: 'checking',
    payee: 'market',
    category: 'groceries',
    amount: -5000,
    date: '2026-01-05',
  });
  const metaId = await db.insertWithUUID('ai_rule_meta', {
    rule_id: 'rule1',
    payee_name: 'Market',
    op: 'contains',
    value: 'MARKET',
    category_id: 'groceries',
    rationale: 'Stable history',
    sample_transaction_ids: '[]',
    status: 'approved',
    hits: 20,
    confirmed: 19,
    corrected: 1,
    run_id: null,
    created_at: Date.now(),
    tombstone: 0,
  });

  expect(
    await recordRuleHit({
      ruleId: 'rule1',
      transactionId: 'txn1',
      categoryId: 'groceries',
    }),
  ).not.toBeNull();

  await markRuleHitCorrectedByUser({
    transactionId: 'txn1',
    finalCategoryId: 'restaurants',
  });

  expect(
    await db.first<{
      hits: number;
      confirmed: number;
      corrected: number;
    }>('SELECT hits, confirmed, corrected FROM ai_rule_meta WHERE id = ?', [
      metaId,
    ]),
  ).toEqual({ hits: 0, confirmed: 0, corrected: 2 });
  expect(
    await db.first<{ status: string }>(
      'SELECT status FROM ai_rule_hits WHERE rule_meta_id = ?',
      [metaId],
    ),
  ).toEqual({ status: 'corrected' });
});
