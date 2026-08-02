import { createAllBudgets } from '#server/budget/base';
import * as db from '#server/db';
import * as sheet from '#server/sheet';
import * as monthUtils from '#shared/months';

import {
  getSumAmountQuery,
  getTotalTransfersByMonthQuery,
  getTotalTransfersQuery,
} from './budget-queries';
import { resetBudgetRegimeCache } from './regime';
import { ensureStatements } from './statements';

beforeEach(() => {
  resetBudgetRegimeCache();
  return global.emptyDatabase()();
});

async function setRegime(regime: 'purchase' | 'payment') {
  await db.update('preferences', { id: 'budgetRegime', value: regime });
  resetBudgetRegimeCache();
}

async function prepare() {
  await sheet.loadSpreadsheet(db);

  await db.insertCategoryGroup({ id: 'group1', name: 'group1' });
  await db.insertCategoryGroup({ id: 'group2', name: 'income', is_income: 1 });
  const catId = await db.insertCategory({ name: 'food', cat_group: 'group1' });

  await db.insertAccount({ id: 'checking', name: 'checking' });
  await db.insertAccount({ id: 'card', name: 'card' });
  // Closing day 25, due day 5: a January statement (Dec 26 – Jan 25)
  // is due Feb 5, so it hits the February budget under the payment
  // regime
  await db.update('accounts', { id: 'card', closing_day: 25, due_day: 5 });
  await ensureStatements('card');

  return catId;
}

function cell(month: string, catId: string) {
  return sheet.getCellValue(
    monthUtils.sheetForMonth(month),
    `sum-amount-${catId}`,
  );
}

function queryAmount(query: string): number {
  return db.runQuery<{ amount: number }>(query, [], true)[0]?.amount || 0;
}

function queryAmountsByMonth(query: string): Map<number, number> {
  return new Map(
    db
      .runQuery<{ month: number; amount: number }>(query, [], true)
      .map(row => [row.month, row.amount || 0]),
  );
}

async function insertLinkedTransaction({
  id,
  amount,
  account,
  category,
  date = '2017-01-15',
  ...extra
}: {
  id: string;
  amount: number;
  account: string;
  category?: string;
  date?: string;
  is_child?: boolean;
  parent_id?: string;
}) {
  await db.insertTransaction({
    id,
    date,
    amount,
    account,
    category,
    transfer_id: `linked-${id}`,
    ...extra,
  });
}

async function referenceCategoryTotal(
  categoryIds: string[],
  start: number,
  end: number,
): Promise<number> {
  return categoryIds.reduce(
    (total, categoryId) =>
      total + queryAmount(getSumAmountQuery(categoryId, start, end)),
    0,
  );
}

describe('Budget regime', () => {
  it('purchase regime (default) buckets by transaction date', async () => {
    const catId = await prepare();

    // Purchase after the closing day still counts in its own month
    await db.insertTransaction({
      date: '2017-01-26',
      amount: -5000,
      account: 'card',
      category: catId,
    });
    await db.insertTransaction({
      date: '2017-01-10',
      amount: -2000,
      account: 'checking',
      category: catId,
    });

    await createAllBudgets();
    await sheet.waitOnSpreadsheet();

    expect(cell('2017-01', catId)).toBe(-7000);
    expect(cell('2017-02', catId)).toBe(0);
    expect(cell('2017-03', catId)).toBe(0);
  });

  it('payment regime buckets card purchases by statement due month', async () => {
    const catId = await prepare();
    await setRegime('payment');

    // Jan 10 purchase: statement closes Jan 25, due Feb 5 -> February
    await db.insertTransaction({
      date: '2017-01-10',
      amount: -5000,
      account: 'card',
      category: catId,
    });
    // Jan 26 purchase (after closing): statement closes Feb 25, due
    // Mar 5 -> March
    await db.insertTransaction({
      date: '2017-01-26',
      amount: -3000,
      account: 'card',
      category: catId,
    });
    // Non-card accounts always bucket by date month
    await db.insertTransaction({
      date: '2017-01-10',
      amount: -2000,
      account: 'checking',
      category: catId,
    });

    await createAllBudgets();
    await sheet.waitOnSpreadsheet();

    expect(cell('2017-01', catId)).toBe(-2000);
    expect(cell('2017-02', catId)).toBe(-5000);
    expect(cell('2017-03', catId)).toBe(-3000);
  });

  it('payment regime keeps cold build and incremental recompute in lockstep', async () => {
    const catId = await prepare();
    await setRegime('payment');

    await createAllBudgets();
    await sheet.waitOnSpreadsheet();
    expect(cell('2017-02', catId)).toBe(0);

    // Incremental path: insert after the budgets exist so the change
    // flows through handleTransactionChange
    await db.insertTransaction({
      date: '2017-01-10',
      amount: -4000,
      account: 'card',
      category: catId,
    });
    await sheet.waitOnSpreadsheet();

    expect(cell('2017-01', catId)).toBe(0);
    expect(cell('2017-02', catId)).toBe(-4000);
  });

  it('payment regime without card config behaves exactly like purchase regime', async () => {
    await sheet.loadSpreadsheet(db);

    await db.insertCategoryGroup({ id: 'group1', name: 'group1' });
    await db.insertCategoryGroup({
      id: 'group2',
      name: 'income',
      is_income: 1,
    });
    const catId = await db.insertCategory({
      name: 'food',
      cat_group: 'group1',
    });
    await db.insertAccount({ id: 'plain', name: 'plain' });

    await setRegime('payment');

    await db.insertTransaction({
      date: '2017-01-26',
      amount: -5000,
      account: 'plain',
      category: catId,
    });

    await createAllBudgets();
    await sheet.waitOnSpreadsheet();

    // No statements exist, so the COALESCE fallback yields the date
    // month — identical to historical behavior
    expect(cell('2017-01', catId)).toBe(-5000);
    expect(cell('2017-02', catId)).toBe(0);
  });

  it('payment regime prioritizes a real pluggy_bill_id over the derived date range', async () => {
    const catId = await prepare();
    await setRegime('payment');
    // The regime-change rebuild is fired without being awaited (it runs
    // inside a synchronous DB transaction, same constraint as the
    // budget-type switch), so wait for it to settle before proceeding
    await sheet.waitOnSpreadsheet();

    // This transaction's date (Jan 26) would derive to the statement
    // closing Feb 25 (due March) by date range alone. But it carries a
    // real Pluggy bill link pointing at the January-closing statement
    // (due February) — e.g. because the bank's real closing day for
    // this particular month landed a day later than usual. The real
    // link must win over the date-based guess.
    const statements = await db.all<{ id: string; end_date: number }>(
      'SELECT id, end_date FROM statements WHERE acct = ? ORDER BY end_date',
      ['card'],
    );
    const januaryStatement = statements.find(s => s.end_date === 20170125)!;
    await db.update('statements', {
      id: januaryStatement.id,
      pluggy_bill_id: 'real-bill-1',
    });

    await db.insertTransaction({
      id: 'trans-1',
      date: '2017-01-26',
      amount: -3000,
      account: 'card',
      category: catId,
    });
    await db.update('transactions', {
      id: 'trans-1',
      pluggy_bill_id: 'real-bill-1',
    });

    await createAllBudgets();
    await sheet.waitOnSpreadsheet();

    // Lands in February (the January statement's due month) rather
    // than March (what the Jan 26 date range alone would suggest)
    expect(cell('2017-02', catId)).toBe(-3000);
    expect(cell('2017-03', catId)).toBe(0);
  });
});

describe('Total transfer queries', () => {
  it('matches the category aggregate while respecting budget scope and effective mappings', async () => {
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
    await db.insertCategoryGroup({ id: 'dead-group', name: 'Dead' });
    await db.update('category_groups', { id: 'dead-group', tombstone: 1 });

    const visible = await db.insertCategory({
      name: 'Visible',
      cat_group: 'visible-group',
    });
    const hidden = await db.insertCategory({
      name: 'Hidden',
      cat_group: 'visible-group',
      hidden: 1,
    });
    const hiddenGroupCategory = await db.insertCategory({
      name: 'Hidden group category',
      cat_group: 'hidden-group',
    });
    const mappedToVisible = await db.insertCategory({
      name: 'Mapped to visible',
      cat_group: 'visible-group',
    });
    const mappedToHidden = await db.insertCategory({
      name: 'Mapped to hidden',
      cat_group: 'visible-group',
    });
    const income = await db.insertCategory({
      name: 'Income category',
      cat_group: 'income-group',
      is_income: 1,
    });
    const deadCategory = await db.insertCategory({
      name: 'Dead category',
      cat_group: 'visible-group',
    });
    await db.update('categories', { id: deadCategory, tombstone: 1 });
    const categoryInDeadGroup = await db.insertCategory({
      name: 'Category in dead group',
      cat_group: 'dead-group',
    });

    await db.update('category_mapping', {
      id: mappedToVisible,
      transferId: visible,
    });
    await db.update('category_mapping', {
      id: mappedToHidden,
      transferId: hidden,
    });

    await db.insertAccount({ id: 'onbudget', name: 'On budget' });
    await db.insertAccount({
      id: 'offbudget',
      name: 'Off budget',
      offbudget: 1,
    });

    await insertLinkedTransaction({
      id: 'visible',
      amount: -100,
      account: 'onbudget',
      category: visible,
    });
    await insertLinkedTransaction({
      id: 'hidden',
      amount: -200,
      account: 'onbudget',
      category: hidden,
    });
    await insertLinkedTransaction({
      id: 'hidden-group',
      amount: -300,
      account: 'onbudget',
      category: hiddenGroupCategory,
    });
    await insertLinkedTransaction({
      id: 'mapped-visible',
      amount: -400,
      account: 'onbudget',
      category: mappedToVisible,
    });
    await insertLinkedTransaction({
      id: 'mapped-hidden',
      amount: -500,
      account: 'onbudget',
      category: mappedToHidden,
    });
    await insertLinkedTransaction({
      id: 'offbudget',
      amount: -600,
      account: 'offbudget',
      category: visible,
    });
    await insertLinkedTransaction({
      id: 'income',
      amount: -700,
      account: 'onbudget',
      category: income,
    });
    await insertLinkedTransaction({
      id: 'dead-category',
      amount: -800,
      account: 'onbudget',
      category: deadCategory,
    });
    await insertLinkedTransaction({
      id: 'dead-group',
      amount: -900,
      account: 'onbudget',
      category: categoryInDeadGroup,
    });

    const start = 20170101;
    const end = 20170131;
    const envelopeReference = await referenceCategoryTotal(
      [visible, hidden, hiddenGroupCategory],
      start,
      end,
    );
    const trackingReference = await referenceCategoryTotal(
      [visible],
      start,
      end,
    );

    expect(queryAmount(getTotalTransfersQuery('envelope', start, end))).toBe(
      envelopeReference,
    );
    expect(queryAmount(getTotalTransfersQuery('tracking', start, end))).toBe(
      trackingReference,
    );
    expect(
      queryAmountsByMonth(
        getTotalTransfersByMonthQuery('envelope', start, end),
      ).get(201701),
    ).toBe(envelopeReference);
    expect(
      queryAmountsByMonth(
        getTotalTransfersByMonthQuery('tracking', start, end),
      ).get(201701),
    ).toBe(trackingReference);
  });

  it('uses only transfer_id for split children, orphan links, and tombstoned twins', async () => {
    await db.insertCategoryGroup({ id: 'expense-group', name: 'Expenses' });
    const category = await db.insertCategory({
      name: 'Expense',
      cat_group: 'expense-group',
    });
    await db.insertAccount({ id: 'onbudget', name: 'On budget' });
    await db.insertAccount({ id: 'other', name: 'Other' });

    await db.insertTransaction({
      id: 'parent',
      date: '2017-01-15',
      amount: -300,
      account: 'onbudget',
      is_parent: true,
    });
    await insertLinkedTransaction({
      id: 'split-child',
      amount: -300,
      account: 'onbudget',
      category,
      is_child: true,
      parent_id: 'parent',
    });
    await insertLinkedTransaction({
      id: 'orphan-link',
      amount: -100,
      account: 'onbudget',
      category,
    });
    await db.insertTransaction({
      id: 'dead-twin',
      date: '2017-01-15',
      amount: 200,
      account: 'other',
      tombstone: true,
    });
    await db.insertTransaction({
      id: 'twin-link',
      date: '2017-01-15',
      amount: -200,
      account: 'onbudget',
      category,
      transfer_id: 'dead-twin',
    });
    const transferPayee = await db.insertPayee({
      name: 'Transfer without link',
      transfer_acct: 'other',
    });
    await db.insertTransaction({
      id: 'payee-without-link',
      date: '2017-01-15',
      amount: -400,
      account: 'onbudget',
      category,
      payee: transferPayee,
    });

    expect(
      queryAmount(getTotalTransfersQuery('envelope', 20170101, 20170131)),
    ).toBe(-600);
  });

  it('keeps monthly and grouped payment queries aligned for statements, closed accounts, and fallback months', async () => {
    await db.insertCategoryGroup({ id: 'expense-group', name: 'Expenses' });
    const category = await db.insertCategory({
      name: 'Expense',
      cat_group: 'expense-group',
    });
    await db.insertAccount({ id: 'card', name: 'Closed card' });
    await db.update('accounts', {
      id: 'card',
      closing_day: 25,
      due_day: 5,
      closed: 1,
    });
    await ensureStatements('card');
    await db.insertAccount({ id: 'plain', name: 'Plain account' });
    await setRegime('payment');

    await insertLinkedTransaction({
      id: 'statement-february',
      date: '2017-01-10',
      amount: -500,
      account: 'card',
      category,
    });
    await insertLinkedTransaction({
      id: 'statement-march',
      date: '2017-01-26',
      amount: -300,
      account: 'card',
      category,
    });
    await insertLinkedTransaction({
      id: 'fallback-january',
      date: '2017-01-10',
      amount: -200,
      account: 'plain',
      category,
    });

    const grouped = queryAmountsByMonth(
      getTotalTransfersByMonthQuery('envelope', 20170101, 20170331),
    );
    for (const [month, start, end] of [
      [201701, 20170101, 20170131],
      [201702, 20170201, 20170228],
      [201703, 20170301, 20170331],
    ] as const) {
      const monthly = queryAmount(
        getTotalTransfersQuery('envelope', start, end),
      );
      expect(monthly).toBe(grouped.get(month) || 0);
      expect(monthly).toBe(
        queryAmount(getSumAmountQuery(category, start, end)),
      );
    }

    expect(grouped).toEqual(
      new Map([
        [201701, -200],
        [201702, -500],
        [201703, -300],
      ]),
    );
  });
});
