// Budget "spent" query builders, regime-aware. The per-cell query and
// the cold-build grouped query MUST stay in lockstep — the filters and
// the effective-month expression have to match exactly so balances
// stay identical between a cold build and incremental recomputes.
// Keeping both builders in this one file is what guarantees that.
//
// Under the default `purchase` regime these return the exact original
// SQL used before credit card support existed, so behavior and
// performance are byte-identical for existing budgets.
import * as db from '#server/db';
import { resolveName } from '#server/spreadsheet/util';
import * as monthUtils from '#shared/months';

import { intToMonth } from './period-math';
import { getBudgetRegime } from './regime';

// A statement's budget month is the month of its due date, which is
// always within a few months after the transaction date (due date
// follows the closing date by at most ~40 days, and a purchase lands
// in a statement closing at most one month later). A 3-month lookback
// window is therefore provably sufficient, and keeping an explicit
// `t.date` range preserves index usage.
const LOOKBACK_MONTHS = 3;

// A transaction imported from a Pluggy Open Finance connector with a
// real bill link is matched to its statement by that link alone,
// bypassing date-range ambiguity entirely (e.g. a closing day that
// shifts month to month for weekends/holidays); everything else falls
// back to the derived date range exactly as before.
function paymentJoin(): string {
  return `LEFT JOIN statements s ON s.acct = t.account
           AND IFNULL(s.tombstone, 0) = 0
           AND (
             (t.pluggy_bill_id IS NOT NULL AND s.pluggy_bill_id = t.pluggy_bill_id)
             OR (t.pluggy_bill_id IS NULL AND t.date >= s.start_date AND t.date <= s.end_date)
           )`;
}

function lookbackStart(start: number): number {
  const month = intToMonth(Math.floor(start / 100));
  return monthUtils.bounds(monthUtils.subMonths(month, LOOKBACK_MONTHS)).start;
}

/**
 * SQL for the `sum-amount-{categoryId}` cell of the month bounded by
 * `[start, end]` (YYYYMMDD integers).
 */
export function getSumAmountQuery(
  catId: string,
  start: number,
  end: number,
): string {
  if (getBudgetRegime() === 'purchase') {
    return `SELECT SUM(amount) as amount FROM v_transactions_internal_alive t
           LEFT JOIN accounts a ON a.id = t.account
         WHERE t.date >= ${start} AND t.date <= ${end}
           AND category = '${catId}' AND a.offbudget = 0`;
  }

  const month = Math.floor(start / 100);
  return `SELECT SUM(t.amount) as amount FROM v_transactions_internal_alive t
       LEFT JOIN accounts a ON a.id = t.account
       ${paymentJoin()}
     WHERE t.date >= ${lookbackStart(start)} AND t.date <= ${end}
       AND COALESCE(s.budget_month, t.date / 100) = ${month}
       AND t.category = '${catId}' AND a.offbudget = 0`;
}

/**
 * SQL for the cold-build grouped query seeding every `sum-amount` cell
 * in `[rangeStart, rangeEnd]` (YYYYMMDD integers). Returns rows of
 * `{ month, category, amount }`; months outside the seeded range are
 * simply ignored by the consumer.
 */
export function getSumAmountsByMonthQuery(
  rangeStart: number,
  rangeEnd: number,
): string {
  if (getBudgetRegime() === 'purchase') {
    return `SELECT t.category AS category,
            t.date / 100 AS month,
            SUM(t.amount) AS amount
       FROM v_transactions_internal_alive t
       LEFT JOIN accounts a ON a.id = t.account
      WHERE t.date >= ${rangeStart} AND t.date <= ${rangeEnd}
        AND t.category IS NOT NULL
        AND a.offbudget = 0
      GROUP BY t.category, t.date / 100`;
  }

  return `SELECT t.category AS category,
          COALESCE(s.budget_month, t.date / 100) AS month,
          SUM(t.amount) AS amount
     FROM v_transactions_internal_alive t
     LEFT JOIN accounts a ON a.id = t.account
     ${paymentJoin()}
    WHERE t.date >= ${lookbackStart(rangeStart)} AND t.date <= ${rangeEnd}
      AND t.category IS NOT NULL
      AND a.offbudget = 0
    GROUP BY t.category, COALESCE(s.budget_month, t.date / 100)`;
}

/**
 * The budget month (`yyyy-MM`) a transaction's amount counts toward.
 * Under the payment regime this is the covering statement's budget
 * month; without a covering statement (non-card accounts, data
 * predating card config) it falls back to the date month — identical
 * to the historical behavior.
 */
export function getEffectiveBudgetMonth(transaction: {
  acct?: string;
  date?: number;
  pluggy_bill_id?: string | null;
}): string {
  const dateMonth = monthUtils.monthFromDate(
    db.fromDateRepr(transaction.date as number),
  );
  if (getBudgetRegime() === 'purchase' || transaction.acct == null) {
    return dateMonth;
  }

  const billId = transaction.pluggy_bill_id ?? null;
  const statement = db.firstSync<{ budget_month: number }>(
    `SELECT budget_month FROM statements
      WHERE acct = ? AND tombstone = 0
        AND (
          (? IS NOT NULL AND pluggy_bill_id = ?)
          OR (? IS NULL AND ? >= start_date AND ? <= end_date)
        )`,
    [
      transaction.acct,
      billId,
      billId,
      billId,
      transaction.date ?? null,
      transaction.date ?? null,
    ],
  );
  return statement != null ? intToMonth(statement.budget_month) : dateMonth;
}

type SheetLike = {
  recompute: (name: string) => void;
};

/**
 * Recompute hook for `statements` table changes (wired into
 * `triggerBudgetChanges`): when a statement's period or budget month
 * changes, every category used on that account must recompute for both
 * the old and the new budget months.
 */
export function handleStatementChange(
  spreadsheet: SheetLike,
  months: Set<string>,
  oldValue: { acct?: string; budget_month?: number } | undefined,
  newValue: { acct?: string; budget_month?: number },
): void {
  if (getBudgetRegime() === 'purchase') {
    return;
  }

  const acct = newValue.acct ?? oldValue?.acct;
  if (acct == null) {
    return;
  }

  const rows = db.runQuery<{ category: string }>(
    `SELECT DISTINCT(category) as category FROM transactions
      WHERE acct = ? AND category IS NOT NULL`,
    [acct],
    true,
  );
  if (rows.length === 0) {
    return;
  }

  const affectedMonths = new Set<string>();
  if (oldValue?.budget_month != null) {
    affectedMonths.add(intToMonth(oldValue.budget_month));
  }
  if (newValue.budget_month != null) {
    affectedMonths.add(intToMonth(newValue.budget_month));
  }

  for (const month of affectedMonths) {
    // Only recompute months whose sheets exist in the loaded range
    if (!months.has(month)) {
      continue;
    }
    const sheetName = monthUtils.sheetForMonth(month);
    for (const row of rows) {
      spreadsheet.recompute(
        resolveName(sheetName, 'sum-amount-' + row.category),
      );
    }
  }
}
