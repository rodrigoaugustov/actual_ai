import { describe, expect, it } from 'vitest';

import {
  assertCanStartRun,
  BudgetExceededError,
  isOverRunLimit,
} from './budget';

describe('assertCanStartRun', () => {
  it('allows a run when under the daily limit', () => {
    expect(() =>
      assertCanStartRun({ maxCostPerDayUsd: 5 }, 4.99),
    ).not.toThrow();
  });

  it('blocks a run once the daily limit is reached', () => {
    expect(() => assertCanStartRun({ maxCostPerDayUsd: 5 }, 5)).toThrow(
      BudgetExceededError,
    );
  });

  it('blocks a run once the daily limit is exceeded', () => {
    expect(() => assertCanStartRun({ maxCostPerDayUsd: 5 }, 5.5)).toThrow(
      BudgetExceededError,
    );
  });

  it('allows any spend when no daily limit is configured', () => {
    expect(() => assertCanStartRun({}, 1_000_000)).not.toThrow();
  });
});

describe('isOverRunLimit', () => {
  it('flags a run that exceeded the per-run cap', () => {
    expect(isOverRunLimit({ maxCostPerRunUsd: 0.5 }, 0.6)).toBe(true);
  });

  it('does not flag a run within the per-run cap', () => {
    expect(isOverRunLimit({ maxCostPerRunUsd: 0.5 }, 0.5)).toBe(false);
  });

  it('never flags when no per-run cap is configured', () => {
    expect(isOverRunLimit({}, 1_000_000)).toBe(false);
  });
});
