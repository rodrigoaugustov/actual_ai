import * as db from '#server/db';
import * as transfer from '#server/transactions/transfer';

import { getStatements } from './app';
import { syncPluggyBills } from './pluggy';
import { ensureStatements } from './statements';

beforeEach(global.emptyDatabase());

async function prepareCard({
  closingDay = 25,
  dueDay = 5,
}: { closingDay?: number; dueDay?: number } = {}) {
  await db.insertAccount({ id: 'checking', name: 'checking' });
  await db.insertAccount({ id: 'card', name: 'card' });
  await db.update('accounts', {
    id: 'card',
    closing_day: closingDay,
    due_day: dueDay,
  });
  await db.insertPayee({ name: '', transfer_acct: 'checking' });
  await db.insertPayee({ name: '', transfer_acct: 'card' });
  await ensureStatements('card');
}

describe('credit-card app: getStatements balance', () => {
  it('sums purchases only, excluding a bill-payment transfer landing in the same period', async () => {
    await prepareCard();

    // Purchase inside the Jan-closing statement (Dec 26 - Jan 25)
    await db.insertPayee({ name: 'Store' });
    await db.insertTransaction({
      id: 'purchase-1',
      account: 'card',
      amount: -50000,
      date: '2017-01-10',
    });

    // Bill payment (transfer from checking) also landing inside that
    // same statement window
    const transferPayment = {
      id: 'payment-1',
      account: 'checking',
      amount: -50000,
      payee: (await db.first<db.DbPayee>(
        "SELECT * FROM payees WHERE transfer_acct = 'card'",
      ))!.id,
      date: '2017-01-20',
    };
    await db.insertTransaction(transferPayment);
    await transfer.onInsert(transferPayment);

    const statements = await getStatements({ accountId: 'card' });
    const janStatement = statements.find(
      s => s.start_date <= '2017-01-10' && '2017-01-10' <= s.end_date,
    );

    expect(janStatement).toBeDefined();
    // Only the purchase counts — the payment transfer is excluded, so
    // the statement total reflects what was actually charged, not the
    // net cash flow (which would be 0 here since amounts cancel out)
    expect(janStatement!.balance).toBe(-50000);
  });

  it('still counts a plain (non-transfer) credit such as a refund', async () => {
    await prepareCard();

    await db.insertPayee({ name: 'Store' });
    await db.insertTransaction({
      id: 'purchase-1',
      account: 'card',
      amount: -50000,
      date: '2017-01-10',
    });
    await db.insertTransaction({
      id: 'refund-1',
      account: 'card',
      amount: 20000,
      date: '2017-01-15',
    });

    const statements = await getStatements({ accountId: 'card' });
    const janStatement = statements.find(
      s => s.start_date <= '2017-01-10' && '2017-01-10' <= s.end_date,
    );

    expect(janStatement!.balance).toBe(-30000);
  });

  it('prioritizes a real pluggy_bill_id link over date range for the shown balance', async () => {
    await prepareCard();

    const statements = await getStatements({ accountId: 'card' });
    const janStatement = statements.find(
      s => s.start_date <= '2017-01-10' && '2017-01-10' <= s.end_date,
    )!;
    const febStatement = statements.find(
      s => s.start_date > janStatement.end_date,
    )!;

    // Dated Jan 26 (after Jan's closing), so by date range alone this
    // would land in the Feb-closing statement instead
    await db.insertPayee({ name: 'Store' });
    await db.insertTransaction({
      id: 'purchase-1',
      account: 'card',
      amount: -12345,
      date: '2017-01-26',
    });
    await db.update('transactions', {
      id: 'purchase-1',
      pluggy_bill_id: 'bill-jan',
    });
    await db.update('statements', {
      id: janStatement.id,
      pluggy_bill_id: 'bill-jan',
    });

    const after = await getStatements({ accountId: 'card' });
    const afterJan = after.find(s => s.id === janStatement.id)!;
    const afterFeb = after.find(s => s.id === febStatement.id)!;

    expect(afterJan.balance).toBe(-12345);
    expect(afterFeb.balance).toBe(0);
  });

  it('uses the bank-reported total when known, even if it differs from summed transactions', async () => {
    await prepareCard();

    const statements = await getStatements({ accountId: 'card' });
    const janStatement = statements.find(
      s => s.start_date <= '2017-01-10' && '2017-01-10' <= s.end_date,
    )!;

    await db.insertPayee({ name: 'Store' });
    await db.insertTransaction({
      id: 'purchase-1',
      account: 'card',
      amount: -12345,
      date: '2017-01-10',
    });
    await db.update('transactions', {
      id: 'purchase-1',
      pluggy_bill_id: 'bill-jan',
    });
    // The bank's total includes e.g. IOF/interest with no transaction
    // of its own, so it legitimately differs from the summed purchases
    await db.update('statements', {
      id: janStatement.id,
      pluggy_bill_id: 'bill-jan',
      pluggy_total_amount: -13000,
    });

    const after = await getStatements({ accountId: 'card' });
    const afterJan = after.find(s => s.id === janStatement.id)!;

    expect(afterJan.balance).toBe(-13000);
  });

  it('a period with only an unpaired payment credit (no purchases) shows the real $0 total instead of the raw credit', async () => {
    await prepareCard();

    const statements = await getStatements({ accountId: 'card' });
    const janStatement = statements.find(
      s => s.start_date <= '2017-01-10' && '2017-01-10' <= s.end_date,
    )!;

    // A plain, un-flagged credit imported straight from open banking —
    // not a transfer, not linked to any bill (there was nothing to
    // charge a bill id to, since no purchase happened this period)
    await db.insertPayee({ name: 'Bank' });
    await db.insertTransaction({
      id: 'payment-credit-1',
      account: 'card',
      amount: 52000,
      date: '2017-01-15',
    });

    // The bank reports this period's real bill as $0 (no purchases),
    // discovered via the due-month fallback since nothing anchors it
    await syncPluggyBills('card', [
      {
        id: 'bill-jan',
        dueDate: janStatement.due_date,
        billClosingDate: null,
        totalAmount: 0,
      },
    ]);

    const after = await getStatements({ accountId: 'card' });
    const afterJan = after.find(s => s.id === janStatement.id)!;

    expect(afterJan.balance).toBe(0);
  });
});
