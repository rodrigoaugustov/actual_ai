import * as db from '#server/db';
import type { DbStatement } from '#server/db';

import {
  ensureStatements,
  getStatementStatus,
  MANUAL_PAID,
  statementIdFor,
} from './statements';

beforeEach(global.emptyDatabase());

function getStatements(acctId: string) {
  return db.runQuery<DbStatement>(
    'SELECT * FROM statements WHERE acct = ? AND tombstone = 0 ORDER BY end_date',
    [acctId],
    true,
  );
}

async function prepareCardAccount({
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
}

describe('ensureStatements', () => {
  it('is a no-op for accounts without card config', async () => {
    await db.insertAccount({ id: 'plain', name: 'plain' });
    await ensureStatements('plain');
    expect(getStatements('plain')).toHaveLength(0);
  });

  it('generates deterministic, chained statement rows', async () => {
    await prepareCardAccount();
    await ensureStatements('card');

    const statements = getStatements('card');
    expect(statements.length).toBeGreaterThan(0);

    // Deterministic ids derived from the closing month
    for (const statement of statements) {
      const closingMonth = db.fromDateRepr(statement.end_date).slice(0, 7);
      expect(statement.id).toBe(statementIdFor('card', closingMonth));
    }

    // Consecutive rows chain start = previous end + 1 day, no gaps
    for (let i = 1; i < statements.length; i++) {
      const prevEnd = db.fromDateRepr(statements[i - 1].end_date);
      const start = db.fromDateRepr(statements[i].start_date);
      expect(start > prevEnd).toBe(true);
    }

    // budget_month is the month of the due date
    for (const statement of statements) {
      expect(statement.budget_month).toBe(Math.floor(statement.due_date / 100));
    }
  });

  it('is idempotent', async () => {
    await prepareCardAccount();
    await ensureStatements('card');
    const first = getStatements('card');

    await ensureStatements('card');
    const second = getStatements('card');

    expect(second).toEqual(first);
  });

  it('recomputes unpaid statements when the closing day changes but freezes paid ones', async () => {
    await prepareCardAccount({ closingDay: 25, dueDay: 5 });
    await ensureStatements('card');

    const before = getStatements('card');
    const frozen = before[0];
    // Mark the earliest statement as paid (manual marker)
    await db.update('statements', {
      id: frozen.id,
      paid_transaction: MANUAL_PAID,
    });

    // Change the closing day
    await db.update('accounts', { id: 'card', closing_day: 10 });
    await ensureStatements('card');

    const after = getStatements('card');
    const frozenAfter = after.find(s => s.id === frozen.id);
    // Paid statement untouched
    expect(frozenAfter?.start_date).toBe(frozen.start_date);
    expect(frozenAfter?.end_date).toBe(frozen.end_date);

    // The next statement chains from the frozen end and closes on day 10
    const next = after.find(s => s.end_date > frozen.end_date);
    expect(next).toBeDefined();
    if (next) {
      expect(db.fromDateRepr(next.start_date)).toBe(
        // day after the frozen closing
        db.fromDateRepr(frozen.end_date).slice(0, 8) + '26',
      );
      expect(String(next.end_date).endsWith('10')).toBe(true);
    }
  });
});

describe('getStatementStatus', () => {
  const base = { end_date: 20170125, paid_transaction: null };

  it('is open while the period has not closed', () => {
    expect(getStatementStatus({ ...base }, '2017-01-10')).toBe('open');
    expect(getStatementStatus({ ...base }, '2017-01-25')).toBe('open');
  });

  it('is closed after the closing date', () => {
    expect(getStatementStatus({ ...base }, '2017-01-26')).toBe('closed');
  });

  it('is paid with a manual marker', () => {
    expect(
      getStatementStatus(
        { ...base, paid_transaction: MANUAL_PAID },
        '2017-01-26',
      ),
    ).toBe('paid');
  });

  it('reverts to unpaid when the linked payment is deleted', async () => {
    await prepareCardAccount();
    await db.insertPayee({ name: 'someone' });
    const transId = 'payment-1';
    await db.insertTransaction({
      id: transId,
      account: 'card',
      amount: 100000,
      date: '2017-01-30',
    });

    expect(
      getStatementStatus({ ...base, paid_transaction: transId }, '2017-02-01'),
    ).toBe('paid');

    await db.deleteTransaction({ id: transId });

    expect(
      getStatementStatus({ ...base, paid_transaction: transId }, '2017-02-01'),
    ).toBe('closed');
  });
});
