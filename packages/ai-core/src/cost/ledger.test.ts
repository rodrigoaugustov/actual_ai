import { describe, expect, it, vi } from 'vitest';

import type { ProviderConfig } from '#types';

import { buildRunRecord, summarizeCost } from './ledger';
import type { PricingTable } from './pricing';

const config: ProviderConfig = {
  provider: 'anthropic',
  model: 'test-model',
  baseURL: 'https://proxy.example.com/ai/proxy/anthropic',
  fetch: vi.fn() as unknown as typeof fetch,
};

const table: PricingTable = {
  'test-model': { inputPerMTok: 1, outputPerMTok: 5 },
};

describe('buildRunRecord', () => {
  it('derives token buckets and cost from LanguageModelUsage', () => {
    const record = buildRunRecord({
      agent: 'classifier',
      tier: 'standard',
      config,
      usage: {
        inputTokens: 1000,
        inputTokenDetails: {
          noCacheTokens: 800,
          cacheReadTokens: 200,
          cacheWriteTokens: 0,
        },
        outputTokens: 100,
        outputTokenDetails: { textTokens: 100, reasoningTokens: 0 },
        totalTokens: 1100,
      },
      durationMs: 250,
      status: 'ok',
      pricingTable: table,
    });

    expect(record).toMatchObject({
      agent: 'classifier',
      tier: 'standard',
      provider: 'anthropic',
      model: 'test-model',
      inputTokens: 1000,
      outputTokens: 100,
      cacheReadTokens: 200,
      cacheWriteTokens: 0,
      status: 'ok',
    });
    // 800 no-cache in @ $1/M + 200 cache-read falling back to $1/M + 100 out @ $5/M
    expect(record.costUsd).toBeCloseTo(
      (800 / 1e6) * 1 + (200 / 1e6) * 1 + (100 / 1e6) * 5,
      8,
    );
  });

  it('records failures with zeroed usage and the error message', () => {
    const record = buildRunRecord({
      agent: 'classifier',
      tier: 'standard',
      config,
      usage: {
        inputTokens: 0,
        inputTokenDetails: {
          noCacheTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 0,
        outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
        totalTokens: 0,
      },
      durationMs: 50,
      status: 'error',
      error: 'boom',
      pricingTable: table,
    });

    expect(record.status).toBe('error');
    expect(record.error).toBe('boom');
    expect(record.costUsd).toBe(0);
  });
});

describe('summarizeCost', () => {
  it('sums cost across runs and groups by agent', () => {
    const summary = summarizeCost([
      {
        agent: 'classifier',
        tier: 'standard',
        provider: 'anthropic',
        model: 'm',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 1.5,
        durationMs: 1,
        status: 'ok',
      },
      {
        agent: 'rule-miner',
        tier: 'standard',
        provider: 'anthropic',
        model: 'm',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0.5,
        durationMs: 1,
        status: 'ok',
      },
      {
        agent: 'classifier',
        tier: 'standard',
        provider: 'anthropic',
        model: 'm',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 2,
        durationMs: 1,
        status: 'ok',
      },
    ]);

    expect(summary.totalRuns).toBe(3);
    expect(summary.totalCostUsd).toBeCloseTo(4, 8);
    expect(summary.byAgent).toEqual({ classifier: 3.5, 'rule-miner': 0.5 });
  });
});
