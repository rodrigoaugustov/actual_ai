import { createAllBudgets } from '#server/budget/base';
import * as db from '#server/db';
import * as sheet from '#server/sheet';
import * as monthUtils from '#shared/months';

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
