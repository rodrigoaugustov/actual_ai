import type { LanguageModelUsage } from 'ai';

import type { ProviderConfig, RunRecord, RunStatus, Tier } from '#types';

import { DEFAULT_PRICING_TABLE, estimateCostUsd } from './pricing';
import type { PricingTable } from './pricing';

export function buildRunRecord(params: {
  agent: string;
  tier: Tier;
  config: ProviderConfig;
  usage: LanguageModelUsage;
  durationMs: number;
  status: RunStatus;
  error?: string;
  pricingTable?: PricingTable;
}): RunRecord {
  const inputNoCacheTokens =
    params.usage.inputTokenDetails.noCacheTokens ??
    params.usage.inputTokens ??
    0;
  const cacheReadTokens = params.usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWriteTokens = params.usage.inputTokenDetails.cacheWriteTokens ?? 0;
  const outputTokens = params.usage.outputTokens ?? 0;

  const costUsd = estimateCostUsd(
    params.config.model,
    { inputNoCacheTokens, cacheReadTokens, cacheWriteTokens, outputTokens },
    params.pricingTable ?? DEFAULT_PRICING_TABLE,
  );

  return {
    agent: params.agent,
    tier: params.tier,
    provider: params.config.provider,
    model: params.config.model,
    inputTokens: params.usage.inputTokens ?? 0,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costUsd,
    durationMs: params.durationMs,
    status: params.status,
    error: params.error,
  };
}

export function summarizeCost(records: RunRecord[]): {
  totalCostUsd: number;
  totalRuns: number;
  byAgent: Record<string, number>;
} {
  const byAgent: Record<string, number> = {};
  let totalCostUsd = 0;

  for (const record of records) {
    totalCostUsd += record.costUsd;
    byAgent[record.agent] = (byAgent[record.agent] ?? 0) + record.costUsd;
  }

  return { totalCostUsd, totalRuns: records.length, byAgent };
}
