// Installment purchases ("parcelamento"). Each installment is a real,
// independently dated transaction — not a split (which shares one
// date) and not a budget allocation — so it needs zero changes to the
// budget engine: every installment counts toward its own statement's
// month under either regime, exactly like any other transaction.
import * as d from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import * as db from '#server/db';
import { batchUpdateTransactions } from '#server/transactions';
import * as monthUtils from '#shared/months';
import type { TransactionEntity } from '#types/models';

import { statementMonthForDate } from './period-math';

/**
 * Split a total amount into `n` installments, sign-aware, so their
 * sum always equals the original total. The first installment absorbs
 * the rounding remainder (e.g. -1000 in 3x -> [-334, -333, -333]).
 */
export function distributeAmount(totalCents: number, n: number): number[] {
  if (n < 1) {
    throw new Error('Installment count must be at least 1');
  }
  const base = Math.trunc(totalCents / n);
  const remainder = totalCents - base * n;
  return [base + remainder, ...Array(n - 1).fill(base)];
}

/**
 * The purchase date of each installment: installment `k` (1-indexed)
 * targets the statement closing `k - 1` months after the one covering
 * the original purchase date. The naive `addMonths` candidate is
 * clamped by date-fns for short months (e.g. Jan 31 + 1 month = Feb
 * 28); if that clamped date falls outside the target statement's
 * period (closing day earlier in that month), it's snapped forward to
 * the target statement's start date so every installment still lands
 * in the intended statement.
 */
export function installmentDates(
  purchaseDate: string,
  n: number,
  closingDay: number,
): string[] {
  const purchaseMonth = statementMonthForDate(closingDay, purchaseDate);

  return Array.from({ length: n }, (_, k) => {
    if (k === 0) {
      return purchaseDate;
    }
    // Day-preserving month addition (date-fns clamps short months,
    // e.g. Jan 31 + 1 month -> Feb 28) — `monthUtils.addMonths`
    // truncates to `yyyy-MM` so it can't be used here
    const candidate = monthUtils.dayFromDate(
      d.addMonths(d.parseISO(purchaseDate), k),
    );
    const targetMonth = monthUtils.addMonths(purchaseMonth, k);
    if (statementMonthForDate(closingDay, candidate) !== targetMonth) {
      return monthUtils.firstDayOfMonth(targetMonth + '-01');
    }
    return candidate;
  });
}

type CreateInstallmentsParams = {
  account: string;
  payee?: string;
  category?: string;
  notes?: string;
  amount: number;
  count: number;
  date: string;
};

export async function createInstallments({
  account,
  payee,
  category,
  notes,
  amount,
  count,
  date,
}: CreateInstallmentsParams): Promise<TransactionEntity[]> {
  const dbAccount = db.firstSync<{ closing_day: number | null }>(
    'SELECT closing_day FROM accounts WHERE id = ?',
    [account],
  );
  // Non-card accounts have no statement cycle to align to; installments
  // simply land one calendar month apart
  const closingDay = dbAccount?.closing_day ?? 31;

  const amounts = distributeAmount(amount, count);
  const dates = installmentDates(date, count, closingDay);
  const groupId = uuidv4();

  const added: TransactionEntity[] = dates.map((installmentDate, idx) => ({
    id: uuidv4(),
    account,
    payee,
    category,
    date: installmentDate,
    amount: amounts[idx],
    notes: notes ? `${notes} (${idx + 1}/${count})` : `(${idx + 1}/${count})`,
    installment_group: groupId,
    installment_num: idx + 1,
    installment_total: count,
  }));

  const result = await batchUpdateTransactions({ added });
  return result.added;
}

type DeleteInstallmentsParams = {
  groupId: string;
  /** Delete only installments from this number onward; omit for all */
  fromNum?: number;
};

export async function deleteInstallments({
  groupId,
  fromNum,
}: DeleteInstallmentsParams): Promise<string[]> {
  const rows = db.runQuery<{ id: string; installment_num: number }>(
    `SELECT id, installment_num FROM transactions
      WHERE installment_group = ? AND tombstone = 0
        AND (? IS NULL OR installment_num >= ?)`,
    [groupId, fromNum ?? null, fromNum ?? null],
    true,
  );

  await batchUpdateTransactions({
    deleted: rows.map(row => ({ id: row.id })),
  });
  return rows.map(row => row.id);
}
