// Enriches derived statements with real data from Pluggy's Open
// Finance "Bills" API when available. This never invents new period
// boundaries wholesale — it only overwrites fields Pluggy actually
// reports (always: due date and total amount; when present, the real
// closing date), applied to whichever statement the bill belongs to
// (see `findTargetStatement`). Everything degrades gracefully to the
// existing closing_day/due_day-derived behavior when Pluggy data is
// absent, incomplete, or the account isn't a Pluggy Open Finance
// connection.
import * as db from '#server/db';
import type { DbStatement } from '#server/db';
import * as monthUtils from '#shared/months';

import { monthToInt } from './period-math';

export type PluggyBill = {
  id: string;
  dueDate: string | null;
  billClosingDate: string | null;
  /** Positive magnitude reported by the bank, per the Pluggy API */
  totalAmount?: number | null;
};

/** Convert Pluggy's positive bill total into Actual's integer-cents,
 * negative-for-debt convention (matching a purchase transaction's sign). */
function toIntegerAmount(totalAmount: number): number {
  return -Math.round(totalAmount * 100) || 0; // avoid -0
}

function toInt(day: string): number {
  return db.toDateRepr(day);
}

function toDay(dateInt: number): string {
  return db.fromDateRepr(dateInt);
}

/**
 * Find the statement a bill belongs to: prefer an already-imported
 * transaction explicitly linked to this bill (exact), and fall back to
 * matching by the due date's calendar month (always present) when
 * there is none — e.g. a period with no purchases at all (only a
 * payment credit, which never carries a bill link of its own) would
 * otherwise never receive the bank's real, authoritative total and
 * silently keep showing a computed sum that counts the raw payment.
 */
function findTargetStatement(
  acctId: string,
  bill: PluggyBill,
): DbStatement | null {
  const anchorTransaction = db.firstSync<{ date: number }>(
    `SELECT MIN(date) as date FROM transactions
      WHERE acct = ? AND pluggy_bill_id = ? AND tombstone = 0`,
    [acctId, bill.id],
  );
  if (anchorTransaction?.date != null) {
    return db.firstSync<DbStatement>(
      `SELECT * FROM statements
        WHERE acct = ? AND tombstone = 0
          AND ? BETWEEN start_date AND end_date`,
      [acctId, anchorTransaction.date],
    );
  }

  const dueMonth = monthToInt(monthUtils.getMonth(bill.dueDate as string));
  return db.firstSync<DbStatement>(
    `SELECT * FROM statements
      WHERE acct = ? AND tombstone = 0 AND budget_month = ?`,
    [acctId, dueMonth],
  );
}

/**
 * Apply real Pluggy bill data to the statement it belongs to. Call
 * after transactions for this account have been synced and reconciled
 * (so `pluggy_bill_id` is populated on them) and after
 * `ensureStatements` has run.
 */
export async function syncPluggyBills(
  acctId: string,
  bills: PluggyBill[],
): Promise<void> {
  for (const bill of bills) {
    if (bill.id == null || bill.dueDate == null) {
      continue;
    }

    const statement = findTargetStatement(acctId, bill);
    if (statement == null) {
      continue;
    }

    const dueDate = toInt(bill.dueDate);
    const updates: Partial<DbStatement> & { id: string } = {
      id: statement.id,
      pluggy_bill_id: bill.id,
      due_date: dueDate,
      budget_month: monthToInt(monthUtils.getMonth(bill.dueDate)),
    };

    const hasNewTotalAmount =
      bill.totalAmount != null &&
      toIntegerAmount(bill.totalAmount) !== statement.pluggy_total_amount;
    if (hasNewTotalAmount) {
      updates.pluggy_total_amount = toIntegerAmount(bill.totalAmount as number);
    }

    const hasNewClosingDate =
      bill.billClosingDate != null &&
      toInt(bill.billClosingDate) !== statement.end_date;
    if (hasNewClosingDate) {
      updates.end_date = toInt(bill.billClosingDate as string);
    }

    if (
      updates.due_date !== statement.due_date ||
      updates.budget_month !== statement.budget_month ||
      updates.pluggy_bill_id !== statement.pluggy_bill_id ||
      hasNewTotalAmount ||
      hasNewClosingDate
    ) {
      await db.update('statements', updates);
    }

    if (hasNewClosingDate) {
      await realignNextStatementStart(acctId, statement.id, updates.end_date!);
    }
  }
}

/**
 * When a statement's end_date is corrected from real bill data, the
 * immediately following statement's start_date must chain from it (day
 * after) to keep the no-gaps/no-overlaps invariant `ensureStatements`
 * otherwise maintains.
 */
async function realignNextStatementStart(
  acctId: string,
  statementId: string,
  newEndDate: number,
): Promise<void> {
  const current = db.firstSync<Pick<DbStatement, 'end_date'>>(
    'SELECT end_date FROM statements WHERE id = ?',
    [statementId],
  );
  if (current == null) return;

  const next = db.firstSync<Pick<DbStatement, 'id' | 'start_date'>>(
    `SELECT id, start_date FROM statements
      WHERE acct = ? AND tombstone = 0 AND end_date > ?
      ORDER BY end_date ASC
      LIMIT 1`,
    [acctId, newEndDate],
  );
  if (next == null) return;

  const expectedStart = toInt(monthUtils.addDays(toDay(newEndDate), 1));
  if (next.start_date !== expectedStart) {
    await db.update('statements', { id: next.id, start_date: expectedStart });
  }
}
