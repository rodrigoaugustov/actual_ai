export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok?: number;
  cacheWritePerMTok?: number;
};

export type PricingTable = Record<string, ModelPricing>;

// Starting point, not a source of truth — provider prices change often.
// Meant to be overridden from settings (see server/ai/config.ts) rather
// than edited here for routine updates. Ollama and unknown/OpenRouter model
// IDs intentionally fall back to $0 (see estimateCostUsd) rather than
// guessing a downstream price we can't know.
export const DEFAULT_PRICING_TABLE: PricingTable = {
  'claude-haiku-4-5': {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheReadPerMTok: 0.1,
    cacheWritePerMTok: 1.25,
  },
  'claude-sonnet-4-5': {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadPerMTok: 0.3,
    cacheWritePerMTok: 3.75,
  },
  'gpt-5-mini': { inputPerMTok: 0.25, outputPerMTok: 2 },
  'gpt-5': { inputPerMTok: 1.25, outputPerMTok: 10 },
  'gemini-2.5-flash': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  'gemini-2.5-pro': { inputPerMTok: 1.25, outputPerMTok: 10 },
};

export type UsageForCost = {
  inputNoCacheTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
};

export function estimateCostUsd(
  modelId: string,
  usage: UsageForCost,
  table: PricingTable = DEFAULT_PRICING_TABLE,
): number {
  const pricing = table[modelId];
  if (!pricing) return 0;

  const perTok = (tokens: number, ratePerMTok: number) =>
    (tokens / 1_000_000) * ratePerMTok;

  return (
    perTok(usage.inputNoCacheTokens, pricing.inputPerMTok) +
    perTok(
      usage.cacheReadTokens,
      pricing.cacheReadPerMTok ?? pricing.inputPerMTok,
    ) +
    perTok(
      usage.cacheWriteTokens,
      pricing.cacheWritePerMTok ?? pricing.inputPerMTok,
    ) +
    perTok(usage.outputTokens, pricing.outputPerMTok)
  );
}
