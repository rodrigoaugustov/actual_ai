export type BudgetLimits = {
  maxCostPerRunUsd?: number;
  maxCostPerDayUsd?: number;
};

export class BudgetExceededError extends Error {}

/** Call before starting a run. Only checks spend already recorded today —
 * a run's own cost isn't known until it completes, so the daily cap is
 * enforced as "stop starting new runs once today's ledger is at or past the
 * limit," not as a mid-run cutoff. */
export function assertCanStartRun(
  limits: BudgetLimits,
  spentTodayUsd: number,
): void {
  if (
    limits.maxCostPerDayUsd != null &&
    spentTodayUsd >= limits.maxCostPerDayUsd
  ) {
    throw new BudgetExceededError(
      `Today's AI spend ($${spentTodayUsd.toFixed(4)}) already reached the daily limit of $${limits.maxCostPerDayUsd.toFixed(4)}`,
    );
  }
}

/** Call after a run completes; the per-run cap can only be checked against
 * the actual cost, not enforced pre-call. Flags rather than throws — the
 * spend already happened. */
export function isOverRunLimit(
  limits: BudgetLimits,
  actualCostUsd: number,
): boolean {
  return (
    limits.maxCostPerRunUsd != null && actualCostUsd > limits.maxCostPerRunUsd
  );
}
