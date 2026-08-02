import { beforeEach, describe, expect, it } from 'vitest';

import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { buildReportTransactionsQuery } from '#shared/report-transactions-query';

type ReportRow = {
  date: string;
  category: string | null;
  categoryHidden: boolean | null;
  categoryGroup: string | null;
  categoryGroupHidden: boolean | null;
  account: string;
  accountOffBudget: boolean;
  payee: string;
  transferAccount: string | null;
  amount: number;
};

type GroupField = 'category' | 'categoryGroup' | 'payee' | 'account' | 'date';

beforeEach(global.emptyDatabase());

async function seedReportTransactions() {
  await db.insertAccount({ id: 'checking', name: 'Checking' });
  await db.insertAccount({ id: 'savings', name: 'Savings' });
  await db.insertAccount({
    id: 'external',
    name: 'External',
    offbudget: 1,
  });

  await db.insertPayee({ id: 'regular-payee', name: 'Regular' });
  await db.insertPayee({
    id: 'transfer-payee',
    name: 'Transfer payee',
    transfer_acct: 'savings',
  });

  await db.insertCategoryGroup({ id: 'expenses', name: 'Expenses' });
  await db.insertCategoryGroup({
    id: 'hidden-group',
    name: 'Hidden group',
    hidden: 1,
  });
  await db.insertCategory({
    id: 'food',
    name: 'Food',
    cat_group: 'expenses',
  });
  await db.insertCategory({
    id: 'hidden-category',
    name: 'Hidden category',
    cat_group: 'expenses',
    hidden: 1,
  });
  await db.insertCategory({
    id: 'hidden-group-category',
    name: 'Hidden group category',
    cat_group: 'hidden-group',
  });

  const base = {
    account: 'checking',
    payee: 'regular-payee',
    category: 'food',
    date: '2026-01-05',
  };

  await db.insertTransaction({ ...base, id: 'ordinary', amount: -100 });
  await db.insertTransaction({
    ...base,
    id: 'orphan-link',
    amount: -30,
    transfer_id: 'missing-twin',
  });
  await db.insertTransaction({
    ...base,
    id: 'tombstoned-link',
    payee: 'transfer-payee',
    amount: -40,
    transfer_id: 'dead-twin',
  });
  await db.insertTransaction({
    ...base,
    id: 'dead-twin',
    account: 'savings',
    amount: -999,
    tombstone: true,
    transfer_id: 'tombstoned-link',
  });
  await db.insertTransaction({
    ...base,
    id: 'transfer-payee-without-link',
    payee: 'transfer-payee',
    amount: -50,
    transfer_id: null,
  });
  await db.insertTransaction({
    ...base,
    id: 'partial-sync',
    category: null,
    amount: -60,
    transfer_id: 'remote-twin-not-arrived',
  });

  await db.insertTransaction({
    ...base,
    id: 'split-parent',
    amount: -70,
    category: null,
    is_parent: true,
  });
  await db.insertTransaction({
    ...base,
    id: 'split-child',
    amount: -70,
    is_child: true,
    parent_id: 'split-parent',
  });

  await db.insertTransaction({
    ...base,
    id: 'hidden-category-row',
    category: 'hidden-category',
    amount: -80,
  });
  await db.insertTransaction({
    ...base,
    id: 'hidden-group-row',
    category: 'hidden-group-category',
    amount: -25,
  });
  await db.insertTransaction({
    ...base,
    id: 'off-budget-row',
    account: 'external',
    amount: -90,
  });
  await db.insertTransaction({
    ...base,
    id: 'uncategorized-row',
    category: null,
    amount: -20,
  });
  await db.insertTransaction({
    ...base,
    id: 'february-row',
    date: '2026-02-10',
    amount: -15,
  });
}

async function runReportQuery(excludeTransfers: boolean) {
  const query = buildReportTransactionsQuery({
    name: 'debts',
    startDate: '2026-01-01',
    endDate: '2026-02-28',
    intervalGroup: { $month: '$date' },
    intervalFilter: '$month',
    conditionsOpKey: '$and',
    filters: [],
    excludeTransfers,
  });
  const { data } = await aqlQuery(query);
  return data as ReportRow[];
}

function summarize(rows: ReportRow[], field: GroupField) {
  const result = new Map<string, number>();
  rows.forEach(row => {
    const key = row[field] ?? 'uncategorized';
    result.set(key, (result.get(key) ?? 0) + row.amount);
  });
  return Object.fromEntries([...result].sort(([a], [b]) => a.localeCompare(b)));
}

describe('report transfer query with real AQL/SQLite', () => {
  it('materializes the off/on edge matrix before aggregation', async () => {
    await seedReportTransactions();

    const offRows = await runReportQuery(false);
    const onRows = await runReportQuery(true);

    expect(offRows).toHaveLength(7);
    expect(onRows).toHaveLength(7);
    expect(offRows.reduce((total, row) => total + row.amount, 0)).toBe(-580);
    expect(onRows.reduce((total, row) => total + row.amount, 0)).toBe(-450);

    expect(onRows.find(row => row.payee === 'transfer-payee')).toMatchObject({
      amount: -50,
      transferAccount: 'savings',
    });
    expect(
      onRows.find(row => row.category === 'hidden-category'),
    ).toMatchObject({ categoryHidden: true, amount: -80 });
    expect(
      onRows.find(row => row.category === 'hidden-group-category'),
    ).toMatchObject({ categoryGroupHidden: true, amount: -25 });
    expect(onRows.find(row => row.account === 'external')).toMatchObject({
      accountOffBudget: true,
      amount: -90,
    });
    expect(onRows.find(row => row.category === null)).toMatchObject({
      amount: -20,
    });
  });

  it.each([
    [
      'category',
      {
        food: -325,
        'hidden-category': -80,
        'hidden-group-category': -25,
        uncategorized: -20,
      },
      {
        food: -395,
        'hidden-category': -80,
        'hidden-group-category': -25,
        uncategorized: -80,
      },
    ],
    [
      'categoryGroup',
      { expenses: -405, 'hidden-group': -25, uncategorized: -20 },
      { expenses: -475, 'hidden-group': -25, uncategorized: -80 },
    ],
    [
      'payee',
      { 'regular-payee': -400, 'transfer-payee': -50 },
      { 'regular-payee': -490, 'transfer-payee': -90 },
    ],
    [
      'account',
      { checking: -360, external: -90 },
      { checking: -490, external: -90 },
    ],
    [
      'date',
      { '2026-01': -435, '2026-02': -15 },
      { '2026-01': -565, '2026-02': -15 },
    ],
  ] satisfies Array<
    [GroupField, Record<string, number>, Record<string, number>]
  >)(
    'preserves material cardinality and totals for %s',
    async (field, expectedOn, expectedOff) => {
      await seedReportTransactions();

      const onSummary = summarize(await runReportQuery(true), field);
      const offSummary = summarize(await runReportQuery(false), field);

      expect(onSummary).toEqual(expectedOn);
      expect(offSummary).toEqual(expectedOff);
      expect(Object.keys(onSummary)).toHaveLength(
        Object.keys(expectedOn).length,
      );
      expect(Object.keys(offSummary)).toHaveLength(
        Object.keys(expectedOff).length,
      );
    },
  );
});
