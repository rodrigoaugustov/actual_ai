// Global budget regime preference: whether expenses hit the budget in
// the month of the purchase date (`purchase`, the default and the
// historical behavior) or in the month the covering credit card
// statement is due (`payment`).
import * as db from '#server/db';

export type BudgetRegime = 'purchase' | 'payment';

let cachedRegime: BudgetRegime | null = null;

export function getBudgetRegime(): BudgetRegime {
  if (cachedRegime == null) {
    const pref = db.firstSync<{ value: string | null }>(
      "SELECT value FROM preferences WHERE id = 'budgetRegime'",
      [],
    );
    cachedRegime = pref?.value === 'payment' ? 'payment' : 'purchase';
  }
  return cachedRegime;
}

/** Called whenever the `budgetRegime` preference changes (local save
 * or remote sync) and when a budget file is closed. */
export function resetBudgetRegimeCache(): void {
  cachedRegime = null;
}
