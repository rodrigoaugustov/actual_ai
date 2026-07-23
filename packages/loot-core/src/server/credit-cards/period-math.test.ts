import {
  bestPurchaseDay,
  closingDateFor,
  dueDateFor,
  intToMonth,
  monthToInt,
  statementMonthForDate,
  statementPeriod,
} from './period-math';

describe('closingDateFor', () => {
  it('returns the closing day inside the month', () => {
    expect(closingDateFor(25, '2026-07')).toBe('2026-07-25');
    expect(closingDateFor(1, '2026-07')).toBe('2026-07-01');
  });

  it('clamps to the last day of short months', () => {
    expect(closingDateFor(31, '2026-02')).toBe('2026-02-28');
    expect(closingDateFor(31, '2026-04')).toBe('2026-04-30');
    expect(closingDateFor(30, '2026-02')).toBe('2026-02-28');
    expect(closingDateFor(31, '2026-07')).toBe('2026-07-31');
  });

  it('handles leap years', () => {
    expect(closingDateFor(31, '2024-02')).toBe('2024-02-29');
    expect(closingDateFor(29, '2024-02')).toBe('2024-02-29');
    expect(closingDateFor(29, '2025-02')).toBe('2025-02-28');
  });
});

describe('dueDateFor', () => {
  it('uses the same month when the due day falls after closing', () => {
    expect(dueDateFor('2026-07-05', 15)).toBe('2026-07-15');
  });

  it('rolls to the next month when the due day is on or before closing', () => {
    expect(dueDateFor('2026-07-25', 5)).toBe('2026-08-05');
    expect(dueDateFor('2026-07-15', 15)).toBe('2026-08-15');
  });

  it('clamps the due day in short months', () => {
    expect(dueDateFor('2026-01-25', 31)).toBe('2026-01-31');
    expect(dueDateFor('2026-02-25', 31)).toBe('2026-02-28');
  });

  it('rolls across the year boundary', () => {
    expect(dueDateFor('2026-12-28', 5)).toBe('2027-01-05');
  });
});

describe('bestPurchaseDay', () => {
  it('is the day after closing', () => {
    expect(bestPurchaseDay(25)).toBe(26);
    expect(bestPurchaseDay(1)).toBe(2);
  });

  it('wraps at the end of the month', () => {
    expect(bestPurchaseDay(31)).toBe(1);
  });
});

describe('statementMonthForDate', () => {
  it('assigns purchases on or before closing to the same month', () => {
    expect(statementMonthForDate(25, '2026-07-25')).toBe('2026-07');
    expect(statementMonthForDate(25, '2026-07-01')).toBe('2026-07');
  });

  it('assigns purchases after closing to the next month', () => {
    expect(statementMonthForDate(25, '2026-07-26')).toBe('2026-08');
    expect(statementMonthForDate(25, '2026-12-28')).toBe('2027-01');
  });

  it('handles clamped closings in short months', () => {
    // Closing day 30 in February closes on the 28th
    expect(statementMonthForDate(30, '2026-02-28')).toBe('2026-02');
    // There is no Feb 29th 2026, so nothing can fall "after" closing
    // within February; March 1st goes to March as expected
    expect(statementMonthForDate(30, '2026-03-01')).toBe('2026-03');
  });
});

describe('statementPeriod', () => {
  it('runs from the day after the previous closing', () => {
    expect(statementPeriod(25, '2026-07')).toEqual({
      start: '2026-06-26',
      end: '2026-07-25',
    });
  });

  it('never gaps or overlaps around short months', () => {
    // Feb closes on the 28th (clamped from 30), so the March period
    // starts on March 1st
    expect(statementPeriod(30, '2026-02')).toEqual({
      start: '2026-01-31',
      end: '2026-02-28',
    });
    expect(statementPeriod(30, '2026-03')).toEqual({
      start: '2026-03-01',
      end: '2026-03-30',
    });
  });
});

describe('month int conversions', () => {
  it('round-trips', () => {
    expect(monthToInt('2026-07')).toBe(202607);
    expect(intToMonth(202607)).toBe('2026-07');
    expect(intToMonth(monthToInt('1999-12'))).toBe('1999-12');
  });
});
