import { Timestamp } from '@actual-app/crdt';

import {
  getSumAmountQuery,
  getTotalTransfersQuery,
} from '#server/credit-cards/budget-queries';
import { resetBudgetRegimeCache } from '#server/credit-cards/regime';
import { ensureStatements } from '#server/credit-cards/statements';
import * as db from '#server/db';
import { handlers } from '#server/main';
import { runHandler } from '#server/mutators';
import type { BudgetType } from '#server/prefs';
import * as sheet from '#server/sheet';
import { applyMessages, batchMessages } from '#server/sync';
import * as syncMigrations from '#server/sync/migrate';
import * as undo from '#server/undo';
import * as monthUtils from '#shared/months';

import { setBudget } from './actions';
import {
  createBudget,
  refreshAllBudgets,
  resetPrecomputedTotalTransfers,
  setType,
} from './base';

const MONTHS = ['2017-01', '2017-02', '2017-03'] as const;

beforeEach(() => {
  resetBudgetRegimeCache();
  return global.emptyDatabase()();
});

async function setRegime(regime: 'purchase' | 'payment'): Promise<void> {
  await db.update('preferences', { id: 'budgetRegime', value: regime });
  resetBudgetRegimeCache();
}

function recalculateTotalTransfers(
  budgetType: BudgetType,
  month: string,
): number {
  const { start, end } = monthUtils.bounds(month);
  const rows = db.runQuery<{ amount: number | null }>(
    getTotalTransfersQuery(budgetType, start, end),
    [],
    true,
  );
  return rows[0]?.amount ?? 0;
}

function expectTotalTransfersToMatch(
  budgetType: BudgetType,
  months: readonly string[] = MONTHS,
): void {
  for (const month of months) {
    expect(
      sheet.getCellValue(monthUtils.sheetForMonth(month), 'total-transfers'),
    ).toBe(recalculateTotalTransfers(budgetType, month));
  }
}

function recalculateSumAmount(category: string, month: string): number {
  const { start, end } = monthUtils.bounds(month);
  const rows = db.runQuery<{ amount: number | null }>(
    getSumAmountQuery(category, start, end),
    [],
    true,
  );
  return rows[0]?.amount ?? 0;
}

function recalculateTotalSpent(budgetType: BudgetType, month: string): number {
  const hiddenFilter =
    budgetType === 'tracking'
      ? 'AND IFNULL(c.hidden, 0) = 0 AND IFNULL(g.hidden, 0) = 0'
      : '';
  const categories = db.runQuery<{ id: string }>(
    `SELECT c.id
     FROM categories c
     JOIN category_groups g ON g.id = c.cat_group
     WHERE IFNULL(c.tombstone, 0) = 0
       AND IFNULL(g.tombstone, 0) = 0
       AND g.is_income = 0
       ${hiddenFilter}
     ORDER BY g.is_income, g.sort_order, g.id, c.sort_order, c.id`,
    [],
    true,
  );

  return categories.reduce(
    (total, category) => total + recalculateSumAmount(category.id, month),
    0,
  );
}

function expectRawAndTransferTotalsToMatch(
  budgetType: BudgetType,
  category: string,
  months: readonly string[] = [MONTHS[0]],
): void {
  for (const month of months) {
    const sheetName = monthUtils.sheetForMonth(month);
    expect(sheet.getCellValue(sheetName, `sum-amount-${category}`)).toBe(
      recalculateSumAmount(category, month),
    );
    expect(sheet.getCellValue(sheetName, 'total-spent')).toBe(
      recalculateTotalSpent(budgetType, month),
    );
    expect(sheet.getCellValue(sheetName, 'total-transfers')).toBe(
      recalculateTotalTransfers(budgetType, month),
    );
  }
}

const ENVELOPE_SUMMARY_CELLS = [
  'from-last-month',
  'total-income',
  'available-funds',
  'last-month-overspent',
  'total-budgeted',
  'buffered',
  'buffered-auto',
  'buffered-selected',
  'to-budget',
  'total-spent',
  'total-leftover',
  'total-transfers',
] as const;

const TRACKING_SUMMARY_CELLS = [
  'total-budgeted',
  'total-spent',
  'total-income',
  'total-leftover',
  'total-budget-income',
  'total-saved',
  'real-saved',
  'total-transfers',
] as const;

function snapshotSummary(budgetType: BudgetType, month: string = MONTHS[0]) {
  const sheetName = monthUtils.sheetForMonth(month);
  const cells =
    budgetType === 'envelope' ? ENVELOPE_SUMMARY_CELLS : TRACKING_SUMMARY_CELLS;

  return cells.map(cell => {
    const node = sheet.get().getNode(`${sheetName}!${cell}`);
    return {
      cell,
      value: node.value,
      dependencies: [...(node._dependencies || [])],
    };
  });
}

async function preparePurchaseBudget(
  budgetType: BudgetType = 'envelope',
): Promise<{
  expense: string;
  otherExpense: string;
  income: string;
  hiddenCategory: string;
}> {
  await sheet.loadSpreadsheet(db);
  sheet.get().meta().budgetType = budgetType;

  await db.insertCategoryGroup({ id: 'expense-group', name: 'Expenses' });
  await db.insertCategoryGroup({
    id: 'income-group',
    name: 'Income',
    is_income: 1,
  });
  const expense = await db.insertCategory({
    id: 'expense',
    name: 'Expense',
    cat_group: 'expense-group',
  });
  const otherExpense = await db.insertCategory({
    id: 'other-expense',
    name: 'Other expense',
    cat_group: 'expense-group',
  });
  const income = await db.insertCategory({
    id: 'income',
    name: 'Income',
    cat_group: 'income-group',
    is_income: 1,
  });
  const hiddenCategory = await db.insertCategory({
    id: 'hidden-category',
    name: 'Hidden expense',
    cat_group: 'expense-group',
    hidden: 1,
  });

  await db.insertAccount({ id: 'onbudget', name: 'On budget' });
  await db.insertAccount({
    id: 'offbudget',
    name: 'Off budget',
    offbudget: 1,
  });

  await createBudget([...MONTHS]);
  await sheet.waitOnSpreadsheet();

  return { expense, otherExpense, income, hiddenCategory };
}

function totalTransferSql(calls: readonly (readonly unknown[])[]): string[] {
  return calls
    .map(call => call[0])
    .filter(
      (sql): sql is string =>
        typeof sql === 'string' && sql.includes('t.transfer_id IS NOT NULL'),
    );
}

function expectOneGroupedTotalTransferQuery(
  calls: readonly (readonly unknown[])[],
): void {
  const queries = totalTransferSql(calls);
  expect(queries).toHaveLength(1);
  expect(queries[0]).toContain('GROUP BY');
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

async function abandonPrecomputedTotalTransfers({
  failureCell,
  mappingId,
  transferId,
}: {
  failureCell: string;
  mappingId: string;
  transferId: string;
}): Promise<void> {
  const failureSheet = monthUtils.sheetForMonth(MONTHS[0]);
  const failureName = `${failureSheet}!${failureCell}`;
  let shouldThrow = false;

  sheet.get().startTransaction();
  try {
    sheet.get().createDynamic(failureSheet, failureCell, {
      initialValue: 0,
      run: () => {
        if (shouldThrow) {
          throw new Error('Expected test computation failure');
        }
        return 0;
      },
    });
    for (const month of MONTHS) {
      sheet
        .get()
        .addDependencies(monthUtils.sheetForMonth(month), 'total-transfers', [
          failureName,
        ]);
    }
  } finally {
    sheet.get().endTransaction();
  }
  await sheet.waitOnSpreadsheet();

  shouldThrow = true;
  sheet.get().startTransaction();
  try {
    sheet.get().recompute(failureName);
    await db.update('category_mapping', {
      id: mappingId,
      transferId,
    });
  } finally {
    sheet.get().endTransaction();
  }

  // The queued failure discards the total-transfer recomputations while their
  // grouped one-shot values remain available for a later computation.
  await Promise.resolve();
  await sheet.waitOnSpreadsheet();
  shouldThrow = false;
}

describe('total-transfers invalidation', () => {
  it('observes transferred_id without requiring a payee change', async () => {
    const { expense } = await preparePurchaseBudget();
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');

    await db.update('transactions', {
      id: 'transaction',
      transferred_id: 'orphan-link',
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-100);

    await db.update('transactions', {
      id: 'transaction',
      transferred_id: null,
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');
  });

  it('keeps remote sync and undo on the central invalidation path', async () => {
    const { expense } = await preparePurchaseBudget();
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
    });
    await sheet.waitOnSpreadsheet();

    const remoteTimestamp = Timestamp.send();
    if (remoteTimestamp == null) {
      throw new Error('CRDT timestamp was not initialized');
    }
    await applyMessages([
      {
        dataset: 'transactions',
        row: 'transaction',
        column: 'transferred_id',
        value: 'remote-link',
        timestamp: remoteTimestamp,
      },
    ]);
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-100);

    undo.clearUndo();
    await undo.withUndo(() =>
      db.update('transactions', {
        id: 'transaction',
        transferred_id: null,
      }),
    );
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');

    await undo.undo();
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-100);
  });

  it.each([
    ['purchase', 'envelope'],
    ['purchase', 'tracking'],
    ['payment', 'envelope'],
    ['payment', 'tracking'],
  ] as const)(
    'tracks split membership through sync migration, reparenting, removal, and undo in %s/%s',
    async (regime, budgetType) => {
      await setRegime(regime);
      const { expense } = await preparePurchaseBudget(budgetType);
      await db.insert('transactions', {
        id: 'split-parent',
        date: 20170115,
        acct: 'onbudget',
        amount: 0,
        isParent: 1,
        tombstone: 0,
      });
      await db.insert('transactions', {
        id: 'dead-parent',
        date: 20170115,
        acct: 'onbudget',
        amount: 0,
        isParent: 1,
        tombstone: 1,
      });
      await sheet.waitOnSpreadsheet();

      const januarySheet = monthUtils.sheetForMonth(MONTHS[0]);
      function expectSplitTotalsToMatchFresh(): void {
        expectRawAndTransferTotalsToMatch(budgetType, expense);
        const rawAmount = sheet.getCellValue(
          januarySheet,
          `sum-amount-${expense}`,
        );
        expect(sheet.getCellValue(januarySheet, 'total-spent')).toBe(rawAmount);
        expect(sheet.getCellValue(januarySheet, 'total-transfers')).toBe(
          rawAmount,
        );
      }

      const remoteTimestamp = Timestamp.send();
      if (remoteTimestamp == null) {
        throw new Error('CRDT timestamp was not initialized');
      }

      syncMigrations.listen();
      try {
        const remoteFields = [
          ['date', 20170115],
          ['acct', 'onbudget'],
          ['amount', -175],
          ['category', expense],
          ['transferred_id', 'split-link'],
          ['isParent', 0],
          ['isChild', 1],
          ['tombstone', 0],
        ] satisfies ReadonlyArray<readonly [string, string | number | null]>;
        await applyMessages(
          remoteFields.map(([column, value]) => ({
            dataset: 'transactions',
            row: 'split-parent/child',
            column,
            value,
            timestamp: remoteTimestamp,
          })),
        );
        // The migration queues its parent_id patch on the sequential sync
        // executor. An empty batch waits behind that queued second apply.
        await applyMessages([]);
        await sheet.waitOnSpreadsheet();
      } finally {
        syncMigrations.unlisten();
      }

      expect(
        db.firstSync<{ parent_id: string | null }>(
          'SELECT parent_id FROM transactions WHERE id = ?',
          ['split-parent/child'],
        )?.parent_id,
      ).toBe('split-parent');
      expectSplitTotalsToMatchFresh();

      undo.clearUndo();
      await undo.withUndo(() =>
        db.update('transactions', {
          id: 'split-parent/child',
          parent_id: 'dead-parent',
        }),
      );
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();
      expect(
        sheet.getCellValue(
          monthUtils.sheetForMonth(MONTHS[0]),
          `sum-amount-${expense}`,
        ),
      ).toBe(0);

      await undo.undo();
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();

      undo.clearUndo();
      await undo.withUndo(() =>
        db.update('transactions', {
          id: 'split-parent/child',
          parent_id: null,
        }),
      );
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();
      expect(
        sheet.getCellValue(
          monthUtils.sheetForMonth(MONTHS[0]),
          `sum-amount-${expense}`,
        ),
      ).toBe(0);

      await undo.undo();
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();

      await db.update('transactions', {
        id: 'split-parent/child',
        parent_id: null,
      });
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();

      undo.clearUndo();
      await undo.withUndo(() =>
        db.update('transactions', {
          id: 'split-parent/child',
          isChild: 0,
        }),
      );
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();
      expect(
        sheet.getCellValue(
          monthUtils.sheetForMonth(MONTHS[0]),
          `sum-amount-${expense}`,
        ),
      ).toBe(-175);

      await undo.undo();
      await sheet.waitOnSpreadsheet();
      expectSplitTotalsToMatchFresh();
      expect(
        sheet.getCellValue(
          monthUtils.sheetForMonth(MONTHS[0]),
          `sum-amount-${expense}`,
        ),
      ).toBe(0);
    },
  );

  it('recomputes old and new effective months for every transaction field in the matrix', async () => {
    const { expense, otherExpense, income } = await preparePurchaseBudget();
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
      transfer_id: 'orphan-link',
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');

    for (const update of [
      { date: 20170215 },
      { acct: 'offbudget' },
      { acct: 'onbudget' },
      { amount: -250 },
      { category: income },
      { category: otherExpense },
      { tombstone: 1 },
      { tombstone: 0 },
      { isParent: 1 },
      { isParent: 0 },
    ]) {
      await db.update('transactions', { id: 'transaction', ...update });
      await sheet.waitOnSpreadsheet();
      expectTotalTransfersToMatch('envelope');
    }
  });

  it('uses old and new statement months when pluggy_bill_id changes in payment mode', async () => {
    await sheet.loadSpreadsheet(db);
    sheet.get().meta().budgetType = 'envelope';
    await db.insertCategoryGroup({ id: 'expense-group', name: 'Expenses' });
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });
    const expense = await db.insertCategory({
      id: 'expense',
      name: 'Expense',
      cat_group: 'expense-group',
    });
    await db.insertAccount({ id: 'card', name: 'Card' });
    await db.update('accounts', {
      id: 'card',
      closing_day: 25,
      due_day: 5,
    });
    await ensureStatements('card');
    await setRegime('payment');

    const statements = await db.all<{ id: string; end_date: number }>(
      'SELECT id, end_date FROM statements WHERE acct = ?',
      ['card'],
    );
    const januaryStatement = statements.find(
      statement => statement.end_date === 20170125,
    );
    if (januaryStatement == null) {
      throw new Error('January statement was not generated');
    }
    await db.update('statements', {
      id: januaryStatement.id,
      pluggy_bill_id: 'real-bill',
    });

    await createBudget([...MONTHS]);
    await sheet.waitOnSpreadsheet();
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-26',
      amount: -300,
      account: 'card',
      category: expense,
      transfer_id: 'orphan-link',
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-03'),
        'total-transfers',
      ),
    ).toBe(-300);

    await db.update('transactions', {
      id: 'transaction',
      pluggy_bill_id: 'real-bill',
    });
    await sheet.waitOnSpreadsheet();

    expectTotalTransfersToMatch('envelope');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-02'),
        'total-transfers',
      ),
    ).toBe(-300);
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-03'),
        'total-transfers',
      ),
    ).toBe(0);
  });

  it.each(['envelope', 'tracking'] as const)(
    'broadly reseeds category mappings in one query and clears absent months in %s',
    async budgetType => {
      const { expense, hiddenCategory } =
        await preparePurchaseBudget(budgetType);
      await db.insertTransaction({
        id: 'transaction',
        date: '2017-01-15',
        amount: -100,
        account: 'onbudget',
        category: expense,
        transfer_id: 'orphan-link',
      });
      await sheet.waitOnSpreadsheet();
      expectTotalTransfersToMatch(budgetType);

      const runQuerySpy = vi.spyOn(db, 'runQuery');
      runQuerySpy.mockClear();
      await db.update('category_mapping', {
        id: expense,
        transferId: hiddenCategory,
      });
      await sheet.waitOnSpreadsheet();
      expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
      runQuerySpy.mockClear();
      expectTotalTransfersToMatch(budgetType);
      expect(
        sheet.getCellValue(
          monthUtils.sheetForMonth('2017-01'),
          'total-transfers',
        ),
      ).toBe(budgetType === 'tracking' ? 0 : -100);

      runQuerySpy.mockClear();
      await db.update('category_mapping', {
        id: expense,
        transferId: expense,
      });
      await sheet.waitOnSpreadsheet();
      expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
      runQuerySpy.mockRestore();
      expectTotalTransfersToMatch(budgetType);
    },
  );

  it('coalesces multiple broad row changes in one event into one grouped query', async () => {
    const { expense, otherExpense, hiddenCategory } =
      await preparePurchaseBudget('tracking');
    await db.insertTransaction({
      id: 'first',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
      transfer_id: 'linked-first',
    });
    await db.insertTransaction({
      id: 'second',
      date: '2017-02-15',
      amount: -200,
      account: 'onbudget',
      category: otherExpense,
      transfer_id: 'linked-second',
    });
    await sheet.waitOnSpreadsheet();

    const runQuerySpy = vi.spyOn(db, 'runQuery');
    runQuerySpy.mockClear();
    await batchMessages(async () => {
      await db.update('category_mapping', {
        id: expense,
        transferId: hiddenCategory,
      });
      await db.update('category_mapping', {
        id: otherExpense,
        transferId: hiddenCategory,
      });
    });
    await sheet.waitOnSpreadsheet();

    expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
    runQuerySpy.mockRestore();
    expectTotalTransfersToMatch('tracking');
    expect(
      MONTHS.map(month =>
        sheet.getCellValue(monthUtils.sheetForMonth(month), 'total-transfers'),
      ),
    ).toEqual([0, 0, 0]);
  });

  it('broadly reseeds all loaded months when an account crosses the budget boundary', async () => {
    const { expense } = await preparePurchaseBudget();
    await db.insertTransaction({
      id: 'january',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
      transfer_id: 'linked-january',
    });
    await db.insertTransaction({
      id: 'february',
      date: '2017-02-15',
      amount: -200,
      account: 'onbudget',
      category: expense,
      transfer_id: 'linked-february',
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');
    const januarySheet = monthUtils.sheetForMonth('2017-01');
    sheet.get().createDynamic(januarySheet, 'transfer-dependent', {
      initialValue: 0,
      dependencies: ['total-transfers'],
      run: (amount: number) => amount * 2,
    });
    await sheet.waitOnSpreadsheet();
    expect(sheet.getCellValue(januarySheet, 'transfer-dependent')).toBe(-200);

    const runQuerySpy = vi.spyOn(db, 'runQuery');
    runQuerySpy.mockClear();
    await db.update('accounts', { id: 'onbudget', offbudget: 1 });
    await sheet.waitOnSpreadsheet();
    expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
    runQuerySpy.mockClear();
    expectTotalTransfersToMatch('envelope');
    expect(
      MONTHS.map(month =>
        sheet.getCellValue(monthUtils.sheetForMonth(month), 'total-transfers'),
      ),
    ).toEqual([0, 0, 0]);
    expect(sheet.getCellValue(januarySheet, 'transfer-dependent')).toBe(0);

    runQuerySpy.mockClear();
    await db.update('accounts', { id: 'onbudget', offbudget: 0 });
    await sheet.waitOnSpreadsheet();
    expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
    runQuerySpy.mockRestore();
    expectTotalTransfersToMatch('envelope');
    expect(sheet.getCellValue(januarySheet, 'transfer-dependent')).toBe(-200);
  });

  it.each(['envelope', 'tracking'] as const)(
    'broadly invalidates category scope fields and limits hidden to tracking in %s',
    async budgetType => {
      const { expense } = await preparePurchaseBudget(budgetType);
      await db.insertTransaction({
        id: 'transaction',
        date: '2017-01-15',
        amount: -100,
        account: 'onbudget',
        category: expense,
        transfer_id: 'orphan-link',
      });
      await sheet.waitOnSpreadsheet();

      const runQuerySpy = vi.spyOn(db, 'runQuery');
      async function applyCategoryChange(
        update: Record<string, string | number>,
        shouldReseed = true,
      ): Promise<void> {
        runQuerySpy.mockClear();
        await db.update('categories', { id: expense, ...update });
        await sheet.waitOnSpreadsheet();
        if (shouldReseed) {
          expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
        } else {
          expect(totalTransferSql(runQuerySpy.mock.calls)).toHaveLength(0);
        }
        runQuerySpy.mockClear();
        expectTotalTransfersToMatch(budgetType);
      }

      await applyCategoryChange({ hidden: 1 }, budgetType === 'tracking');
      await applyCategoryChange({ hidden: 0 }, budgetType === 'tracking');
      await applyCategoryChange({ cat_group: 'income-group' });
      await applyCategoryChange({ cat_group: 'expense-group' });
      await applyCategoryChange({ tombstone: 1 });
      await applyCategoryChange({ tombstone: 0 });
      await applyCategoryChange({ is_income: 1 });
      await applyCategoryChange({ is_income: 0 });
      runQuerySpy.mockRestore();
    },
  );

  it.each(['envelope', 'tracking'] as const)(
    'broadly invalidates group scope fields and limits hidden to tracking in %s',
    async budgetType => {
      const { expense } = await preparePurchaseBudget(budgetType);
      await db.insertTransaction({
        id: 'transaction',
        date: '2017-01-15',
        amount: -100,
        account: 'onbudget',
        category: expense,
        transfer_id: 'orphan-link',
      });
      await sheet.waitOnSpreadsheet();

      const runQuerySpy = vi.spyOn(db, 'runQuery');
      async function applyGroupChange(
        update: Record<string, string | number>,
        shouldReseed = true,
      ): Promise<void> {
        runQuerySpy.mockClear();
        await db.update('category_groups', {
          id: 'expense-group',
          ...update,
        });
        await sheet.waitOnSpreadsheet();
        if (shouldReseed) {
          expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
        } else {
          expect(totalTransferSql(runQuerySpy.mock.calls)).toHaveLength(0);
        }
        runQuerySpy.mockClear();
        expectTotalTransfersToMatch(budgetType);
      }

      await applyGroupChange({ hidden: 1 }, budgetType === 'tracking');
      await applyGroupChange({ hidden: 0 }, budgetType === 'tracking');
      await applyGroupChange({ tombstone: 1 });
      await applyGroupChange({ tombstone: 0 });
      await applyGroupChange({ is_income: 1 });
      await applyGroupChange({ is_income: 0 });
      runQuerySpy.mockRestore();
    },
  );

  it.each(['envelope', 'tracking'] as const)(
    'mirrors the rebuilt income/expense summary graph in both directions in %s',
    async budgetType => {
      const { expense, income } = await preparePurchaseBudget(budgetType);
      await db.insertTransaction({
        id: 'linked-expense',
        date: '2017-01-15',
        amount: -100,
        account: 'onbudget',
        category: expense,
        transfer_id: 'linked-expense',
      });
      await db.insertTransaction({
        id: 'ordinary-income',
        date: '2017-01-16',
        amount: 500,
        account: 'onbudget',
        category: income,
      });
      await setBudget({ category: expense, month: MONTHS[0], amount: 40 });
      if (budgetType === 'tracking') {
        await setBudget({ category: income, month: MONTHS[0], amount: 300 });
      }
      await sheet.waitOnSpreadsheet();

      function expectClassificationValues(
        isIncome: boolean,
        isExcludedFromExpenses = false,
      ): void {
        const sheetName = monthUtils.sheetForMonth(MONTHS[0]);
        expect(sheet.getCellValue(sheetName, 'total-income')).toBe(
          isIncome ? -100 : 500,
        );
        expect(sheet.getCellValue(sheetName, 'total-spent')).toBe(
          isIncome || isExcludedFromExpenses ? 0 : -100,
        );
        expect(sheet.getCellValue(sheetName, 'total-transfers')).toBe(
          isIncome || isExcludedFromExpenses ? 0 : -100,
        );

        if (budgetType === 'envelope') {
          expect(sheet.getCellValue(sheetName, 'to-budget')).toBe(
            isIncome ? -100 : isExcludedFromExpenses ? 500 : 460,
          );
        } else {
          expect(sheet.getCellValue(sheetName, 'total-budget-income')).toBe(
            isIncome ? 40 : 300,
          );
          expect(sheet.getCellValue(sheetName, 'total-saved')).toBe(
            isIncome ? 40 : isExcludedFromExpenses ? 300 : 260,
          );
          expect(sheet.getCellValue(sheetName, 'real-saved')).toBe(
            isIncome ? -100 : isExcludedFromExpenses ? 500 : 400,
          );
        }
      }

      async function applyAndCompareWithRebuild(
        update: Record<string, number>,
        isIncome: boolean,
        isExcludedFromExpenses = false,
      ): Promise<void> {
        const runQuerySpy = vi.spyOn(db, 'runQuery');
        runQuerySpy.mockClear();
        await db.update('category_groups', {
          id: 'expense-group',
          ...update,
        });
        await sheet.waitOnSpreadsheet();
        expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
        runQuerySpy.mockRestore();

        expectRawAndTransferTotalsToMatch(budgetType, expense, MONTHS);
        expectClassificationValues(isIncome, isExcludedFromExpenses);
        const incrementalSummaries = MONTHS.map(month =>
          snapshotSummary(budgetType, month),
        );

        await refreshAllBudgets();
        await sheet.waitOnSpreadsheet();

        expect(MONTHS.map(month => snapshotSummary(budgetType, month))).toEqual(
          incrementalSummaries,
        );
        expectRawAndTransferTotalsToMatch(budgetType, expense, MONTHS);
        expectClassificationValues(isIncome, isExcludedFromExpenses);
      }

      await applyAndCompareWithRebuild({ is_income: 1 }, true);
      await applyAndCompareWithRebuild({ is_income: 0 }, false);

      if (budgetType === 'tracking') {
        await applyAndCompareWithRebuild({ hidden: 1 }, false, true);
        await applyAndCompareWithRebuild({ is_income: 1 }, true, true);
        await applyAndCompareWithRebuild({ is_income: 0 }, false, true);
        await applyAndCompareWithRebuild({ hidden: 0 }, false);
      }
    },
  );

  it('broadly reseeds statement period, budget month, and account changes in payment mode', async () => {
    await sheet.loadSpreadsheet(db);
    sheet.get().meta().budgetType = 'envelope';
    await db.insertCategoryGroup({ id: 'expense-group', name: 'Expenses' });
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });
    const expense = await db.insertCategory({
      id: 'expense',
      name: 'Expense',
      cat_group: 'expense-group',
    });
    await db.insertAccount({ id: 'card', name: 'Card' });
    await db.insertAccount({ id: 'other-card', name: 'Other card' });
    await setRegime('payment');
    await db.insert('statements', {
      id: 'statement',
      acct: 'card',
      start_date: 20170101,
      end_date: 20170131,
      due_date: 20170205,
      budget_month: 201702,
      paid_transaction: null,
      pluggy_bill_id: null,
      tombstone: 0,
    });
    await createBudget([...MONTHS]);
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-15',
      amount: -100,
      account: 'card',
      category: expense,
      transfer_id: 'orphan-link',
    });
    await sheet.waitOnSpreadsheet();
    expectTotalTransfersToMatch('envelope');

    const runQuerySpy = vi.spyOn(db, 'runQuery');
    async function applyStatementChange(
      update: Record<string, string | number>,
    ): Promise<void> {
      runQuerySpy.mockClear();
      await db.update('statements', { id: 'statement', ...update });
      await sheet.waitOnSpreadsheet();
      expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
      runQuerySpy.mockClear();
      expectTotalTransfersToMatch('envelope');
    }

    await applyStatementChange({ budget_month: 201703 });
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-02'),
        'total-transfers',
      ),
    ).toBe(0);
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-03'),
        'total-transfers',
      ),
    ).toBe(-100);

    await applyStatementChange({
      start_date: 20170120,
      end_date: 20170131,
    });
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-100);
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-03'),
        'total-transfers',
      ),
    ).toBe(0);

    await applyStatementChange({
      start_date: 20170101,
      end_date: 20170131,
    });
    await applyStatementChange({ acct: 'other-card' });
    await applyStatementChange({ acct: 'card' });

    runQuerySpy.mockClear();
    await setRegime('purchase');
    runQuerySpy.mockClear();
    await refreshAllBudgets();
    await sheet.waitOnSpreadsheet();
    expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
    runQuerySpy.mockRestore();
    expectTotalTransfersToMatch('envelope');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-100);
  });

  it('seeds only newly extended horizon months with one grouped query', async () => {
    await sheet.loadSpreadsheet(db);
    sheet.get().meta().budgetType = 'envelope';
    await db.insertCategoryGroup({ id: 'expense-group', name: 'Expenses' });
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });
    const expense = await db.insertCategory({
      id: 'expense',
      name: 'Expense',
      cat_group: 'expense-group',
    });
    await db.insertAccount({ id: 'onbudget', name: 'On budget' });
    await createBudget(['2017-01']);
    await db.insertTransaction({
      id: 'january',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
      transfer_id: 'linked-january',
    });
    await db.insertTransaction({
      id: 'february',
      date: '2017-02-15',
      amount: -200,
      account: 'onbudget',
      category: expense,
      transfer_id: 'linked-february',
    });
    await sheet.waitOnSpreadsheet();

    const januaryName = monthUtils.sheetForMonth('2017-01');
    const januaryNode = sheet.get().getNode(`${januaryName}!total-transfers`);
    const runQuerySpy = vi.spyOn(db, 'runQuery');
    runQuerySpy.mockClear();
    await createBudget([...MONTHS]);
    await sheet.waitOnSpreadsheet();
    expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
    runQuerySpy.mockRestore();

    expect(sheet.get().getNode(`${januaryName}!total-transfers`)).toBe(
      januaryNode,
    );
    expectTotalTransfersToMatch('envelope');
  });

  it('rebuilds every total-transfers cell through the grouped builder when budget type changes', async () => {
    const { hiddenCategory } = await preparePurchaseBudget('envelope');
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: hiddenCategory,
      transfer_id: 'orphan-link',
    });
    await sheet.waitOnSpreadsheet();
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-100);

    const runQuerySpy = vi.spyOn(db, 'runQuery');
    runQuerySpy.mockClear();
    await setType('tracking');
    await sheet.waitOnSpreadsheet();
    expectOneGroupedTotalTransferQuery(runQuerySpy.mock.calls);
    runQuerySpy.mockRestore();
    expectTotalTransfersToMatch('tracking');
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(0);
  });

  it('discards abandoned grouped values on cache reset and spreadsheet lifecycle reset', async () => {
    const { expense, otherExpense } = await preparePurchaseBudget();
    await db.insertTransaction({
      id: 'transaction',
      date: '2017-01-15',
      amount: -100,
      account: 'onbudget',
      category: expense,
      transfer_id: 'orphan-link',
    });
    await sheet.waitOnSpreadsheet();

    await abandonPrecomputedTotalTransfers({
      failureCell: 'cache-reset-failure',
      mappingId: expense,
      transferId: otherExpense,
    });
    db.runQuery('UPDATE transactions SET amount = ? WHERE id = ?', [
      -250,
      'transaction',
    ]);

    await runHandler(handlers['reset-budget-cache']);
    await sheet.waitOnSpreadsheet();
    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-250);

    await abandonPrecomputedTotalTransfers({
      failureCell: 'budget-switch-failure',
      mappingId: expense,
      transferId: expense,
    });
    db.runQuery('UPDATE transactions SET amount = ? WHERE id = ?', [
      -400,
      'transaction',
    ]);

    sheet.unloadSpreadsheet();
    await sheet.loadSpreadsheet(db);
    sheet.get().meta().budgetType = 'envelope';
    resetPrecomputedTotalTransfers();
    await createBudget([...MONTHS]);
    await sheet.waitOnSpreadsheet();

    expect(
      sheet.getCellValue(
        monthUtils.sheetForMonth('2017-01'),
        'total-transfers',
      ),
    ).toBe(-400);
  });

  it.each([
    ['purchase', 'envelope'],
    ['purchase', 'tracking'],
    ['payment', 'envelope'],
    ['payment', 'tracking'],
  ] as const)(
    'matches a full recalculation after a long deterministic mutation sequence in %s/%s',
    async (regime, budgetType) => {
      await sheet.loadSpreadsheet(db);
      sheet.get().meta().budgetType = budgetType;
      await db.insertCategoryGroup({ id: 'visible-group', name: 'Visible' });
      await db.insertCategoryGroup({
        id: 'hidden-group',
        name: 'Hidden',
        hidden: 1,
      });
      await db.insertCategoryGroup({
        id: 'income-group',
        name: 'Income',
        is_income: 1,
      });

      const categoriesToInsert = [
        { id: 'visible', name: 'Visible', cat_group: 'visible-group' },
        { id: 'alternate', name: 'Alternate', cat_group: 'visible-group' },
        {
          id: 'hidden',
          name: 'Hidden',
          cat_group: 'visible-group',
          hidden: 1,
        },
        {
          id: 'hidden-group-category',
          name: 'Hidden group category',
          cat_group: 'hidden-group',
        },
        {
          id: 'income',
          name: 'Income',
          cat_group: 'income-group',
          is_income: 1,
        },
      ] satisfies ReadonlyArray<
        Pick<db.DbCategory, 'id' | 'name' | 'cat_group'> &
          Partial<Pick<db.DbCategory, 'hidden' | 'is_income'>>
      >;
      for (const category of categoriesToInsert) {
        await db.insertCategory(category);
      }

      await db.insertAccount({ id: 'onbudget', name: 'On budget' });
      await db.insertAccount({ id: 'plain', name: 'Plain account' });
      await db.insertAccount({ id: 'card', name: 'Card account' });
      await db.insertAccount({
        id: 'offbudget',
        name: 'Off budget',
        offbudget: 1,
      });
      if (regime === 'payment') {
        await db.update('accounts', {
          id: 'card',
          closing_day: 25,
          due_day: 5,
        });
      }
      await setRegime(regime);

      const primaryAccount = regime === 'payment' ? 'card' : 'onbudget';
      const realBillId = 'long-sequence-real-bill';

      type MutableTransaction = {
        id: string;
        date: number;
        amount: number;
        acct: string;
        category: string;
        transferred_id: string | null;
        tombstone: 0 | 1;
        isParent: 0 | 1;
        pluggy_bill_id: string | null;
      };
      const transactions: MutableTransaction[] = [
        {
          id: 'transaction-0',
          date: regime === 'payment' ? 20170124 : 20170110,
          amount: -100,
          acct: primaryAccount,
          category: 'visible',
          transferred_id: 'link-0',
          tombstone: 0,
          isParent: 0,
          pluggy_bill_id: null,
        },
        {
          id: 'transaction-1',
          date: 20170210,
          amount: -200,
          acct: primaryAccount,
          category: 'alternate',
          transferred_id: 'link-1',
          tombstone: 0,
          isParent: 0,
          pluggy_bill_id: null,
        },
        {
          id: 'transaction-2',
          date: 20170310,
          amount: -300,
          acct: primaryAccount,
          category: 'hidden',
          transferred_id: 'link-2',
          tombstone: 0,
          isParent: 0,
          pluggy_bill_id: null,
        },
        {
          id: 'transaction-3',
          date: 20170120,
          amount: -400,
          acct: primaryAccount,
          category: 'hidden-group-category',
          transferred_id: 'link-3',
          tombstone: 0,
          isParent: 0,
          pluggy_bill_id: null,
        },
        {
          id: 'transaction-4',
          date: 20170220,
          amount: -500,
          acct: 'offbudget',
          category: 'visible',
          transferred_id: 'link-4',
          tombstone: 0,
          isParent: 0,
          pluggy_bill_id: null,
        },
        {
          id: 'transaction-5',
          date: 20170320,
          amount: -600,
          acct: primaryAccount,
          category: 'income',
          transferred_id: 'link-5',
          tombstone: 0,
          isParent: 0,
          pluggy_bill_id: null,
        },
      ];
      for (const transaction of transactions) {
        await db.insertTransaction({
          id: transaction.id,
          date: db.fromDateRepr(transaction.date),
          amount: transaction.amount,
          account: transaction.acct,
          category: transaction.category,
          transfer_id: transaction.transferred_id,
        });
      }

      if (regime === 'payment') {
        await ensureStatements('card');
        const januaryStatement = (
          await db.all<{ id: string; end_date: number }>(
            'SELECT id, end_date FROM statements WHERE acct = ?',
            ['card'],
          )
        ).find(statement => statement.end_date === 20170125);
        if (januaryStatement == null) {
          throw new Error('January statement was not generated');
        }
        await db.update('statements', {
          id: januaryStatement.id,
          pluggy_bill_id: realBillId,
        });
      }

      await createBudget([...MONTHS]);
      await sheet.waitOnSpreadsheet();
      expectTotalTransfersToMatch(budgetType);

      if (regime === 'payment') {
        const transaction = transactions[0];
        const value = (month: string): number => {
          const amount = sheet.getCellValue(
            monthUtils.sheetForMonth(month),
            'total-transfers',
          );
          if (typeof amount !== 'number') {
            throw new Error('Expected total-transfers to be numeric');
          }
          return amount;
        };

        const beforeBoundary = {
          february: value('2017-02'),
          march: value('2017-03'),
        };
        transaction.date = 20170126;
        await db.update('transactions', {
          id: transaction.id,
          date: transaction.date,
        });
        await sheet.waitOnSpreadsheet();
        expect(value('2017-02')).toBe(beforeBoundary.february + 100);
        expect(value('2017-03')).toBe(beforeBoundary.march - 100);
        expectTotalTransfersToMatch(budgetType);

        const beforePlainAccount = {
          january: value('2017-01'),
          march: value('2017-03'),
        };
        transaction.acct = 'plain';
        await db.update('transactions', {
          id: transaction.id,
          acct: transaction.acct,
        });
        await sheet.waitOnSpreadsheet();
        expect(value('2017-01')).toBe(beforePlainAccount.january - 100);
        expect(value('2017-03')).toBe(beforePlainAccount.march + 100);
        expectTotalTransfersToMatch(budgetType);

        transaction.acct = 'card';
        await db.update('transactions', {
          id: transaction.id,
          acct: transaction.acct,
        });
        await sheet.waitOnSpreadsheet();
        expect(value('2017-01')).toBe(beforePlainAccount.january);
        expect(value('2017-03')).toBe(beforePlainAccount.march);
        expectTotalTransfersToMatch(budgetType);

        const beforeRealBill = {
          february: value('2017-02'),
          march: value('2017-03'),
        };
        transaction.pluggy_bill_id = realBillId;
        await db.update('transactions', {
          id: transaction.id,
          pluggy_bill_id: transaction.pluggy_bill_id,
        });
        await sheet.waitOnSpreadsheet();
        expect(value('2017-02')).toBe(beforeRealBill.february - 100);
        expect(value('2017-03')).toBe(beforeRealBill.march + 100);
        expectTotalTransfersToMatch(budgetType);

        transaction.pluggy_bill_id = null;
        await db.update('transactions', {
          id: transaction.id,
          pluggy_bill_id: transaction.pluggy_bill_id,
        });
        await sheet.waitOnSpreadsheet();
        expect(value('2017-02')).toBe(beforeRealBill.february);
        expect(value('2017-03')).toBe(beforeRealBill.march);
        expectTotalTransfersToMatch(budgetType);
      }

      const random = createDeterministicRandom(
        (budgetType === 'envelope' ? 0x41c64e6d : 0x9e3779b9) ^
          (regime === 'payment' ? 0xa5a5a5a5 : 0),
      );
      const dates = [20170105, 20170124, 20170126, 20170215, 20170325] as const;
      const accounts =
        regime === 'payment'
          ? (['card', 'plain', 'offbudget'] as const)
          : (['onbudget', 'offbudget'] as const);
      const categories = [
        'visible',
        'alternate',
        'hidden',
        'hidden-group-category',
        'income',
      ] as const;
      const categoryState = {
        hidden: 0,
        tombstone: 0,
        is_income: 0,
        cat_group: 'visible-group',
      };
      const groupState = { hidden: 0, tombstone: 0, is_income: 0 };
      let accountOffbudget = 0;

      function choose<T>(values: readonly T[]): T {
        return values[random() % values.length];
      }

      const mutations: Array<() => Promise<void>> = [
        async () => {
          const transaction = choose(transactions);
          transaction.date = choose(dates);
          await db.update('transactions', {
            id: transaction.id,
            date: transaction.date,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.acct = choose(accounts);
          await db.update('transactions', {
            id: transaction.id,
            acct: transaction.acct,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.amount = -((random() % 900) + 1);
          await db.update('transactions', {
            id: transaction.id,
            amount: transaction.amount,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.category = choose(categories);
          await db.update('transactions', {
            id: transaction.id,
            category: transaction.category,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.transferred_id =
            transaction.transferred_id == null ? `link-${random()}` : null;
          await db.update('transactions', {
            id: transaction.id,
            transferred_id: transaction.transferred_id,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.tombstone = transaction.tombstone === 0 ? 1 : 0;
          await db.update('transactions', {
            id: transaction.id,
            tombstone: transaction.tombstone,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.isParent = transaction.isParent === 0 ? 1 : 0;
          await db.update('transactions', {
            id: transaction.id,
            isParent: transaction.isParent,
          });
        },
        async () => {
          const transaction = choose(transactions);
          transaction.pluggy_bill_id =
            transaction.pluggy_bill_id == null
              ? regime === 'payment'
                ? realBillId
                : `bill-${random()}`
              : null;
          await db.update('transactions', {
            id: transaction.id,
            pluggy_bill_id: transaction.pluggy_bill_id,
          });
        },
        async () => {
          await db.update('category_mapping', {
            id: 'alternate',
            transferId: choose(categories),
          });
        },
        async () => {
          accountOffbudget = accountOffbudget === 0 ? 1 : 0;
          await db.update('accounts', {
            id: primaryAccount,
            offbudget: accountOffbudget,
          });
        },
        async () => {
          categoryState.hidden = categoryState.hidden === 0 ? 1 : 0;
          await db.update('categories', {
            id: 'visible',
            hidden: categoryState.hidden,
          });
        },
        async () => {
          categoryState.tombstone = categoryState.tombstone === 0 ? 1 : 0;
          await db.update('categories', {
            id: 'visible',
            tombstone: categoryState.tombstone,
          });
        },
        async () => {
          categoryState.is_income = categoryState.is_income === 0 ? 1 : 0;
          await db.update('categories', {
            id: 'visible',
            is_income: categoryState.is_income,
          });
        },
        async () => {
          categoryState.cat_group = choose([
            'visible-group',
            'hidden-group',
            'income-group',
          ] as const);
          await db.update('categories', {
            id: 'visible',
            cat_group: categoryState.cat_group,
          });
        },
        async () => {
          groupState.hidden = groupState.hidden === 0 ? 1 : 0;
          await db.update('category_groups', {
            id: 'visible-group',
            hidden: groupState.hidden,
          });
        },
        async () => {
          groupState.tombstone = groupState.tombstone === 0 ? 1 : 0;
          await db.update('category_groups', {
            id: 'visible-group',
            tombstone: groupState.tombstone,
          });
        },
        async () => {
          groupState.is_income = groupState.is_income === 0 ? 1 : 0;
          await db.update('category_groups', {
            id: 'visible-group',
            is_income: groupState.is_income,
          });
        },
      ];

      for (let step = 0; step < 120; step++) {
        const mutation =
          step < mutations.length
            ? mutations[step]
            : mutations[random() % mutations.length];
        await mutation();
        await sheet.waitOnSpreadsheet();
        expectTotalTransfersToMatch(budgetType);
      }
    },
  );
});
