import * as db from '#server/db';
import type { DbStatement } from '#server/db';

import { syncPluggyBills } from './pluggy';
import { ensureStatements } from './statements';

beforeEach(global.emptyDatabase());

async function prepareCard({
  closingDay = 25,
  dueDay = 5,
}: { closingDay?: number; dueDay?: number } = {}) {
  await db.insertAccount({ id: 'card', name: 'card' });
  await db.update('accounts', {
    id: 'card',
    closing_day: closingDay,
    due_day: dueDay,
  });
  await db.insertPayee({ name: '', transfer_acct: 'card' });
  await ensureStatements('card');
}

function getStatements() {
  return db.runQuery<DbStatement>(
    'SELECT * FROM statements WHERE acct = ? AND tombstone = 0 ORDER BY end_date',
    ['card'],
    true,
  );
}

async function linkTransaction(id: string, date: string, billId: string) {
  await db.insertTransaction({ id, account: 'card', amount: -1000, date });
  await db.update('transactions', { id, pluggy_bill_id: billId });
}

describe('syncPluggyBills', () => {
  it('falls back to matching by due-month when no transaction is linked yet (e.g. a period with only a payment credit, no purchases)', async () => {
    await prepareCard();

    // card#201701 (closing Jan 25) is due Feb 5 — same month as this
    // bill's due date, so it's the fallback match with zero anchors
    await syncPluggyBills('card', [
      { id: 'bill-1', dueDate: '2017-02-05', billClosingDate: null },
    ]);

    const after = getStatements().find(s => s.id === 'card#201701')!;
    expect(after.pluggy_bill_id).toBe('bill-1');
    expect(after.due_date).toBe(20170205);
  });

  it('sets due_date, budget_month, and pluggy_bill_id from a real due date, without touching end_date when no closing date is known', async () => {
    await prepareCard();
    await linkTransaction('t1', '2017-01-10', 'bill-1');

    const before = getStatements().find(
      s => s.start_date <= 20170110 && 20170110 <= s.end_date,
    )!;

    await syncPluggyBills('card', [
      { id: 'bill-1', dueDate: '2017-02-07', billClosingDate: null },
    ]);

    const after = getStatements().find(s => s.id === before.id)!;
    expect(after.pluggy_bill_id).toBe('bill-1');
    expect(after.due_date).toBe(20170207);
    expect(after.budget_month).toBe(201702);
    // Not overwritten: no real closing date was supplied
    expect(after.end_date).toBe(before.end_date);
  });

  it('overwrites end_date from a real closing date and realigns the following statement', async () => {
    await prepareCard();
    await linkTransaction('t1', '2017-01-10', 'bill-1');

    const statementsBefore = getStatements();
    const target = statementsBefore.find(
      s => s.start_date <= 20170110 && 20170110 <= s.end_date,
    )!;
    const next = statementsBefore.find(s => s.end_date > target.end_date)!;

    await syncPluggyBills('card', [
      { id: 'bill-1', dueDate: '2017-02-07', billClosingDate: '2017-01-23' },
    ]);

    const after = getStatements();
    const updatedTarget = after.find(s => s.id === target.id)!;
    const updatedNext = after.find(s => s.id === next.id)!;

    expect(updatedTarget.end_date).toBe(20170123);
    expect(updatedTarget.pluggy_bill_id).toBe('bill-1');
    // No gap/overlap: the next statement now starts the day after
    expect(updatedNext.start_date).toBe(20170124);
  });

  it('does not affect accounts without any linked bill', async () => {
    await prepareCard();
    const before = getStatements();

    await syncPluggyBills('card', []);

    expect(getStatements()).toEqual(before);
  });

  it('stores the bank-reported total amount, converted to negative integer cents', async () => {
    await prepareCard();
    await linkTransaction('t1', '2017-01-10', 'bill-1');

    await syncPluggyBills('card', [
      {
        id: 'bill-1',
        dueDate: '2017-02-07',
        billClosingDate: null,
        totalAmount: 130.5,
      },
    ]);

    const after = getStatements().find(
      s => s.start_date <= 20170110 && 20170110 <= s.end_date,
    )!;
    expect(after.pluggy_total_amount).toBe(-13050);
  });

  it('does not rewrite the total amount when the bank does not report one', async () => {
    await prepareCard();
    await linkTransaction('t1', '2017-01-10', 'bill-1');

    await syncPluggyBills('card', [
      { id: 'bill-1', dueDate: '2017-02-07', billClosingDate: null },
    ]);

    const after = getStatements().find(
      s => s.start_date <= 20170110 && 20170110 <= s.end_date,
    )!;
    expect(after.pluggy_total_amount ?? null).toBe(null);
  });
});
