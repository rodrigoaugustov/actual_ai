// Persisted cooldown state for the rule miner's feedback-triggered mining
// check. Stored the same way as `aiConfig` (see ./config.ts): a single JSON
// blob in the `preferences` table, so it survives restarts without a
// migration.
import * as db from '#server/db';

const MINER_STATE_PREF_ID = 'aiRuleMinerState';

export type RuleMinerState = {
  /** Set on every mining *attempt*, whether or not it actually reached the
   * LLM (disabled/budget-exceeded/no-candidates/run-failed all count). This
   * is what the cooldown is measured from, so an early return doesn't leave
   * every subsequent feedback row re-scanning candidates forever. */
  lastAttemptAt: number;
  /** Only set when a pass actually recorded a run. Informational — not read
   * by the cooldown gate, but useful for diagnosing "did mining ever run". */
  lastRunAt: number;
};

const DEFAULT_STATE: RuleMinerState = { lastAttemptAt: 0, lastRunAt: 0 };

export function getRuleMinerState(): RuleMinerState {
  const pref = db.firstSync<{ value: string | null }>(
    `SELECT value FROM preferences WHERE id = '${MINER_STATE_PREF_ID}'`,
    [],
  );
  if (!pref?.value) return DEFAULT_STATE;

  try {
    return { ...DEFAULT_STATE, ...JSON.parse(pref.value) };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function setRuleMinerState(
  patch: Partial<RuleMinerState>,
): Promise<void> {
  await db.update('preferences', {
    id: MINER_STATE_PREF_ID,
    value: JSON.stringify({ ...getRuleMinerState(), ...patch }),
  });
}
