// Pure date math for credit card statement periods. All functions work
// on the same string representations used across the codebase
// (`yyyy-MM-dd` days and `yyyy-MM` months, see `#shared/months`) so
// they are timezone-free and easily unit-testable.
import * as monthUtils from '#shared/months';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The closing date of the statement that closes in the given month,
 * clamping the configured closing day to the last day of short months
 * (e.g. closing day 31 in February closes on the 28th/29th).
 */
export function closingDateFor(closingDay: number, month: string): string {
  const lastDay = monthUtils.getDay(monthUtils.lastDayOfMonth(month + '-01'));
  return `${month}-${pad2(Math.min(closingDay, lastDay))}`;
}

/**
 * The payment due date for a statement: the first occurrence of the
 * configured due day strictly after the closing date.
 */
export function dueDateFor(closingDate: string, dueDay: number): string {
  const closingMonth = monthUtils.getMonth(closingDate);

  const candidate = clampDayToMonth(dueDay, closingMonth);
  if (candidate > closingDate) {
    return candidate;
  }
  return clampDayToMonth(dueDay, monthUtils.nextMonth(closingMonth));
}

/**
 * The "melhor dia de compra": the day right after the statement
 * closes, when a purchase takes the longest to come due.
 */
export function bestPurchaseDay(closingDay: number): number {
  return closingDay >= 31 ? 1 : closingDay + 1;
}

/**
 * The closing month (`yyyy-MM`) of the statement whose period covers
 * the given date. A purchase on or before the (clamped) closing date
 * belongs to the statement closing that month; later purchases roll
 * into the next month's statement.
 */
export function statementMonthForDate(
  closingDay: number,
  date: string,
): string {
  const month = monthUtils.getMonth(date);
  if (date <= closingDateFor(closingDay, month)) {
    return month;
  }
  return monthUtils.nextMonth(month);
}

/**
 * The inclusive period of the statement closing in the given month,
 * derived purely from the closing day. Note `ensureStatements` chains
 * consecutive rows (`start` = previous row's `end` + 1 day) so that a
 * closing-day change can never create gaps or overlaps; this function
 * gives the canonical period when there is no previous row to chain
 * from.
 */
export function statementPeriod(
  closingDay: number,
  closingMonth: string,
): { start: string; end: string } {
  const end = closingDateFor(closingDay, closingMonth);
  const prevEnd = closingDateFor(
    closingDay,
    monthUtils.prevMonth(closingMonth),
  );
  return { start: monthUtils.addDays(prevEnd, 1), end };
}

/** Convert a `yyyy-MM` month to its integer `YYYYMM` representation. */
export function monthToInt(month: string): number {
  return parseInt(month.replace('-', ''));
}

/** Convert an integer `YYYYMM` month back to `yyyy-MM`. */
export function intToMonth(month: number): string {
  const str = String(month);
  return `${str.slice(0, 4)}-${str.slice(4, 6)}`;
}

function clampDayToMonth(day: number, month: string): string {
  const lastDay = monthUtils.getDay(monthUtils.lastDayOfMonth(month + '-01'));
  return `${month}-${pad2(Math.min(day, lastDay))}`;
}
