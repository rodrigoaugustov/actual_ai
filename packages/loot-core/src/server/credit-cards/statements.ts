// Statement ("fatura") generation and lifecycle. Statement membership
// of a transaction is always DERIVED (`acct` + `date` between
// `start_date` and `end_date`) — never stored — so there are no
// assignment hooks to keep consistent. Rows have deterministic ids
// (`<acctId>#<closingMonth>`) so two devices generating statements
// offline produce identical CRDT messages and converge.
import * as db from '#server/db';
import type { DbAccount, DbStatement } from '#server/db';
import * as monthUtils from '#shared/months';
import type { StatementStatus } from '#types/models';

import {
  closingDateFor,
  dueDateFor,
  monthToInt,
  statementPeriod,
} from './period-math';

/** How many months past the current month statements are generated
 * for. The budget range extends 12 months forward, so keep one extra
 * month of slack. */
const HORIZON_MONTHS = 13;

export function statementIdFor(acctId: string, closingMonth: string): string {
  return `${acctId}#${closingMonth.replace('-', '')}`;
}

function toDay(dateInt: number): string {
  return db.fromDateRepr(dateInt);
}

function toInt(day: string): number {
  return db.toDateRepr(day);
}

export function isCardAccount(
  account: Pick<DbAccount, 'closing_day' | 'due_day'>,
): boolean {
  return account.closing_day != null && account.due_day != null;
}

/**
 * Generate or update statement rows for a card account so they cover
 * `[first transaction month − 1, current month + HORIZON_MONTHS]`.
 * Idempotent: only rows whose values changed are written. Paid
 * statements are frozen historical fact and never rewritten; the next
 * unpaid row chains its `start_date` from the last frozen `end_date`
 * so gaps and overlaps are impossible by construction.
 */
export async function ensureStatements(acctId: string): Promise<void> {
  const account = db.firstSync<
    Pick<DbAccount, 'id' | 'closing_day' | 'due_day' | 'tombstone'>
  >('SELECT id, closing_day, due_day, tombstone FROM accounts WHERE id = ?', [
    acctId,
  ]);

  if (
    account == null ||
    account.tombstone === 1 ||
    account.closing_day == null ||
    account.due_day == null
  ) {
    return;
  }
  const closingDay = account.closing_day;
  const dueDay = account.due_day;

  const firstTrans = db.firstSync<{ date: number | null }>(
    'SELECT MIN(date) as date FROM transactions WHERE acct = ? AND tombstone = 0 AND date IS NOT NULL',
    [acctId],
  );

  const currentMonth = monthUtils.currentMonth();
  let startMonth = currentMonth;
  if (firstTrans && firstTrans.date != null) {
    const firstMonth = monthUtils.getMonth(toDay(firstTrans.date));
    if (firstMonth < startMonth) {
      startMonth = firstMonth;
    }
  }
  startMonth = monthUtils.prevMonth(startMonth);
  const endMonth = monthUtils.addMonths(currentMonth, HORIZON_MONTHS);

  const existingRows = db.runQuery<DbStatement>(
    'SELECT * FROM statements WHERE acct = ? AND tombstone = 0 ORDER BY end_date',
    [acctId],
    true,
  );
  const existingById = new Map(existingRows.map(row => [row.id, row]));

  let prevEnd: string | null = null;
  for (const month of monthUtils.rangeInclusive(startMonth, endMonth)) {
    const id = statementIdFor(acctId, month);
    const existing = existingById.get(id);

    if (existing && existing.paid_transaction != null) {
      // Paid statements are frozen; later rows chain from them.
      prevEnd = toDay(existing.end_date);
      continue;
    }

    const end = closingDateFor(closingDay, month);
    const start =
      prevEnd != null
        ? monthUtils.addDays(prevEnd, 1)
        : statementPeriod(closingDay, month).start;
    const due = dueDateFor(end, dueDay);
    prevEnd = end;

    const row = {
      acct: acctId,
      start_date: toInt(start),
      end_date: toInt(end),
      due_date: toInt(due),
      budget_month: monthToInt(monthUtils.getMonth(due)),
    };

    if (existing == null) {
      await db.insert('statements', { id, ...row, tombstone: 0 });
    } else if (
      existing.start_date !== row.start_date ||
      existing.end_date !== row.end_date ||
      existing.due_date !== row.due_date ||
      existing.budget_month !== row.budget_month
    ) {
      await db.update('statements', { id, ...row });
    }
  }
}

/** Run `ensureStatements` for every open card account. */
export async function ensureAllStatements(): Promise<void> {
  const accounts = db.runQuery<Pick<DbAccount, 'id'>>(
    `SELECT id FROM accounts
      WHERE closing_day IS NOT NULL AND due_day IS NOT NULL
        AND tombstone = 0 AND closed = 0`,
    [],
    true,
  );
  for (const account of accounts) {
    await ensureStatements(account.id);
  }
}

/** Sentinel for statements marked paid without a linked transaction. */
export const MANUAL_PAID = 'manual';

/**
 * Derived statement status: `paid` when `paid_transaction` is set and
 * either is the manual marker or points to a transaction that is still
 * alive — deleting a linked payment "unpays" the statement with zero
 * cleanup code. `closed` once the closing date passed, otherwise
 * `open`.
 */
export function getStatementStatus(
  statement: Pick<DbStatement, 'end_date' | 'paid_transaction'>,
  today: string = monthUtils.currentDay(),
): StatementStatus {
  if (statement.paid_transaction != null) {
    const paidTrans = db.firstSync<{ tombstone: 1 | 0 }>(
      'SELECT tombstone FROM transactions WHERE id = ?',
      [statement.paid_transaction],
    );
    // Unknown id = manual marker; a tombstoned transaction means the
    // linked payment was deleted, reverting the statement to unpaid
    if (paidTrans == null || paidTrans.tombstone === 0) {
      return 'paid';
    }
  }
  return toInt(today) > statement.end_date ? 'closed' : 'open';
}

/**
 * Post-write hook (called from `batchUpdateTransactions`): if a card
 * transaction landed beyond the generated statement horizon, extend
 * the coverage. Membership itself is derived, so missing this on some
 * insert path degrades gracefully (budget falls back to date month)
 * rather than corrupting data.
 */
export async function onTransactionsChanged(
  transactions: Array<{ acct?: string; account?: string; date?: number }>,
): Promise<void> {
  const acctIds = new Set<string>();
  for (const trans of transactions) {
    const acct = trans.acct ?? trans.account;
    if (acct != null) {
      acctIds.add(acct);
    }
  }
  if (acctIds.size === 0) {
    return;
  }

  const placeholders = [...acctIds].map(() => '?').join(', ');
  const cardAccounts = db.runQuery<Pick<DbAccount, 'id'>>(
    `SELECT id FROM accounts
      WHERE id IN (${placeholders})
        AND closing_day IS NOT NULL AND due_day IS NOT NULL
        AND tombstone = 0`,
    [...acctIds],
    true,
  );

  for (const account of cardAccounts) {
    const maxCovered = db.firstSync<{ end_date: number | null }>(
      'SELECT MAX(end_date) as end_date FROM statements WHERE acct = ? AND tombstone = 0',
      [account.id],
    );
    const relevant = transactions.some(trans => {
      const acct = trans.acct ?? trans.account;
      return (
        acct === account.id &&
        (maxCovered == null ||
          maxCovered.end_date == null ||
          (trans.date != null && trans.date > maxCovered.end_date))
      );
    });
    if (relevant) {
      await ensureStatements(account.id);
    }
  }
}
