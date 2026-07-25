import * as db from '#server/db';
import type { AiConfig } from '#types/models/ai';

const CONFIG_PREF_ID = 'aiConfig';

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  tiers: {
    fast: { provider: 'anthropic', model: 'claude-haiku-4-5' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
    frontier: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  },
  confidenceThreshold: 0.8,
  redactPii: true,
  shareSensitiveMemoryWithProvider: false,
  webSearchEnabled: false,
  maxWebSearchesPerBatch: 3,
  maxCostPerDayUsd: 1,
};

export function getAiConfig(): AiConfig {
  const pref = db.firstSync<{ value: string | null }>(
    `SELECT value FROM preferences WHERE id = '${CONFIG_PREF_ID}'`,
    [],
  );
  if (!pref?.value) return DEFAULT_AI_CONFIG;

  try {
    const parsed = JSON.parse(pref.value);
    return {
      ...DEFAULT_AI_CONFIG,
      ...parsed,
      tiers: { ...DEFAULT_AI_CONFIG.tiers, ...parsed.tiers },
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export async function setAiConfig(config: AiConfig): Promise<void> {
  await db.update('preferences', {
    id: CONFIG_PREF_ID,
    value: JSON.stringify(config),
  });
}
