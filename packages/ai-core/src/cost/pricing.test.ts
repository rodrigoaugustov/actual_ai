import { describe, expect, it } from 'vitest';

import { estimateCostUsd } from './pricing';
import type { PricingTable } from './pricing';

describe('estimateCostUsd', () => {
  const table: PricingTable = {
    'test-model': {
      inputPerMTok: 2,
      outputPerMTok: 10,
      cacheReadPerMTok: 0.2,
      cacheWritePerMTok: 2.5,
    },
  };

  it('computes cost from the four token buckets', () => {
    const cost = estimateCostUsd(
      'test-model',
      {
        inputNoCacheTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
        outputTokens: 1_000_000,
      },
      table,
    );
    expect(cost).toBeCloseTo(2 + 0.2 + 2.5 + 10, 6);
  });

  it('falls back to the input rate when cache rates are not set', () => {
    const noCacheRates: PricingTable = {
      m: { inputPerMTok: 4, outputPerMTok: 1 },
    };
    const cost = estimateCostUsd(
      'm',
      {
        inputNoCacheTokens: 0,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 0,
        outputTokens: 0,
      },
      noCacheRates,
    );
    expect(cost).toBeCloseTo(4, 6);
  });

  it('returns 0 for a model absent from the table (e.g. Ollama, unmapped OpenRouter models)', () => {
    const cost = estimateCostUsd('unknown-model', {
      inputNoCacheTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(0);
  });
});
