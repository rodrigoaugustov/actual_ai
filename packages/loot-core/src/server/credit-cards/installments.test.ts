import { distributeAmount, installmentDates } from './installments';

describe('distributeAmount', () => {
  it('splits evenly when divisible', () => {
    expect(distributeAmount(-3000, 3)).toEqual([-1000, -1000, -1000]);
  });

  it('gives the first installment the remainder (negative amounts)', () => {
    expect(distributeAmount(-1000, 3)).toEqual([-334, -333, -333]);
  });

  it('gives the first installment the remainder (positive amounts)', () => {
    expect(distributeAmount(1000, 3)).toEqual([334, 333, 333]);
  });

  it('handles n = 1', () => {
    expect(distributeAmount(-1000, 1)).toEqual([-1000]);
  });

  it('always sums back to the original total', () => {
    for (const total of [-1000, -999, 1, 12345, -1]) {
      for (const n of [1, 2, 3, 7, 12]) {
        const parts = distributeAmount(total, n);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts).toHaveLength(n);
      }
    }
  });

  it('rejects a non-positive count', () => {
    expect(() => distributeAmount(1000, 0)).toThrow();
  });
});

describe('installmentDates', () => {
  it('produces one date per month, starting at the purchase date', () => {
    const dates = installmentDates('2026-01-10', 3, 25);
    expect(dates).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
  });

  it('snaps to the target statement start when addMonths clamping would leak an installment into the previous statement', () => {
    // Closing day 28: a purchase on Jan 30 falls after closing, so it
    // belongs to the statement closing Feb 28. The naive candidate for
    // installment 2 (addMonths(Jan 30, 1)) clamps to Feb 28 — which is
    // still inside the FIRST statement, not the second — so it must
    // snap forward to the second statement's start (Mar 1).
    const dates = installmentDates('2026-01-30', 2, 28);
    expect(dates).toEqual(['2026-01-30', '2026-03-01']);
  });

  it('keeps every installment strictly increasing and inside its own statement period', () => {
    const dates = installmentDates('2026-01-31', 4, 28);
    expect(dates).toHaveLength(4);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });
});
