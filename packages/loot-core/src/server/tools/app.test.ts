import * as db from '#server/db';

import { app } from './app';

beforeEach(() => global.emptyDatabase()());

it('reports only unchanged live on-off and orphan income transfers', async () => {
  await db.insertCategoryGroup({ id: 'income', name: 'Income', is_income: 1 });
  await db.insertCategoryGroup({
    id: 'dead-income',
    name: 'Dead income',
    is_income: 1,
    tombstone: 1,
  });
  await db.insertCategoryGroup({ id: 'expense', name: 'Expense' });
  await db.insertCategory({
    id: 'income-live',
    name: 'Income',
    cat_group: 'income',
  });
  await db.insertCategory({
    id: 'income-dead',
    name: 'Dead income',
    cat_group: 'income',
    tombstone: 1,
  });
  await db.insertCategory({
    id: 'income-dead-group',
    name: 'Dead group',
    cat_group: 'dead-income',
  });
  await db.insertCategory({
    id: 'source',
    name: 'Source',
    cat_group: 'expense',
  });
  await db.insertAccount({ id: 'on', name: 'On budget' });
  await db.insertAccount({ id: 'off', name: 'Off budget', offbudget: 1 });

  for (const id of ['source', 'income-dead', 'income-dead-group']) {
    await db.update('category_mapping', { id, transferId: id });
  }
  await db.update('category_mapping', {
    id: 'source',
    transferId: 'income-live',
  });

  await db.insertTransaction({
    id: 'on-off',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'source',
  });
  await db.insertTransaction({
    id: 'on-off-pair',
    date: '2026-01-01',
    amount: -1,
    account: 'off',
  });
  await db.updateTransaction({ id: 'on-off', transfer_id: 'on-off-pair' });
  await db.updateTransaction({ id: 'on-off-pair', transfer_id: 'on-off' });
  await db.insertTransaction({
    id: 'orphan',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'source',
  });
  await db.updateTransaction({ id: 'orphan', transfer_id: 'missing' });
  await db.insertTransaction({
    id: 'error-transfer',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'source',
    error: 'needs-repair',
  });
  await db.insertTransaction({
    id: 'error-transfer-pair',
    date: '2026-01-01',
    amount: -1,
    account: 'off',
  });
  await db.updateTransaction({
    id: 'error-transfer',
    transfer_id: 'error-transfer-pair',
  });
  await db.updateTransaction({
    id: 'error-transfer-pair',
    transfer_id: 'error-transfer',
  });
  // A parent carrying a category and a transfer link. Clearing the parent's
  // category (step 8) cascades through `transfer.onUpdate` -> `removeTransfer`,
  // which deletes the counterpart leg. That leg is eligible for the report
  // until the moment it is deleted, so the count has to run after step 8.
  await db.insertTransaction({
    id: 'parent-transfer',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'source',
    is_parent: true,
  });
  await db.insertTransaction({
    id: 'parent-transfer-leg',
    date: '2026-01-01',
    amount: -1,
    account: 'off',
    category: 'source',
  });
  await db.updateTransaction({
    id: 'parent-transfer',
    transfer_id: 'parent-transfer-leg',
  });
  await db.updateTransaction({
    id: 'parent-transfer-leg',
    transfer_id: 'parent-transfer',
  });
  await db.insertTransaction({
    id: 'same-side',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'source',
  });
  await db.insertTransaction({
    id: 'same-side-pair',
    date: '2026-01-01',
    amount: -1,
    account: 'on',
  });
  await db.updateTransaction({
    id: 'same-side',
    transfer_id: 'same-side-pair',
  });
  await db.updateTransaction({
    id: 'same-side-pair',
    transfer_id: 'same-side',
  });
  await db.insertTransaction({
    id: 'dead-transaction',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'source',
    tombstone: 1,
  });
  await db.updateTransaction({
    id: 'dead-transaction',
    transfer_id: 'missing-dead',
  });
  await db.insertTransaction({
    id: 'dead-category',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'income-dead',
  });
  await db.updateTransaction({
    id: 'dead-category',
    transfer_id: 'missing-category',
  });
  await db.insertTransaction({
    id: 'dead-group',
    date: '2026-01-01',
    amount: 1,
    account: 'on',
    category: 'income-dead-group',
  });
  await db.updateTransaction({
    id: 'dead-group',
    transfer_id: 'missing-group',
  });

  const reportedIds = ['on-off', 'orphan'];
  const eligibleBeforeRepair = await db.all<{ id: string }>(`
    SELECT t.id
    FROM v_transactions_internal_alive t
    JOIN categories c ON c.id = t.category AND IFNULL(c.tombstone, 0) = 0
    JOIN category_groups g ON g.id = c.cat_group AND IFNULL(g.tombstone, 0) = 0
    WHERE t.transfer_id IS NOT NULL
      AND g.is_income = 1
    ORDER BY t.id
  `);
  const before = await db.all(
    'SELECT * FROM transactions WHERE id IN (?, ?) ORDER BY id',
    reportedIds,
  );
  const result = await app.handlers['tools/fix-split-transactions']();
  const after = await db.all(
    'SELECT * FROM transactions WHERE id IN (?, ?) ORDER BY id',
    reportedIds,
  );
  const sameSide = await db.first<{ category: string | null }>(
    'SELECT category FROM transactions WHERE id = ?',
    ['same-side'],
  );
  const errorTransfer = await db.first<{
    error: string | null;
    transferred_id: string | null;
  }>('SELECT error, transferred_id FROM transactions WHERE id = ?', [
    'error-transfer',
  ]);
  const parentTransferLeg = await db.first<{ tombstone: number }>(
    'SELECT tombstone FROM transactions WHERE id = ?',
    ['parent-transfer-leg'],
  );

  expect(eligibleBeforeRepair.map(row => row.id)).toEqual([
    'error-transfer',
    'on-off',
    'orphan',
    'parent-transfer-leg',
    'same-side',
  ]);
  expect(result.numTransfersInIncomeCategories).toBe(2);
  expect(parentTransferLeg?.tombstone).toBe(1);
  expect(after).toEqual(before);
  expect(sameSide?.category).toBeNull();
  expect(errorTransfer).toEqual({ error: null, transferred_id: null });
});
