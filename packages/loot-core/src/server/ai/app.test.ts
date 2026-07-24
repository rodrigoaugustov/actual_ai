import { getConfig, getUsageSummaryHandler, updateConfig } from './app';
import { DEFAULT_AI_CONFIG } from './config';
import { recordRun } from './runs';

beforeEach(global.emptyDatabase());

describe('ai app handlers', () => {
  it('get-config returns the default config initially', async () => {
    expect(await getConfig()).toEqual(DEFAULT_AI_CONFIG);
  });

  it('update-config then get-config round-trips', async () => {
    const config = {
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.7,
    };
    await updateConfig(config);
    expect(await getConfig()).toEqual(config);
  });

  it('get-usage-summary aggregates recorded runs', async () => {
    await recordRun({
      agent: 'classifier',
      tier: 'standard',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      inputTokens: 100,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0.2,
      durationMs: 100,
      status: 'ok',
    });

    const summary = await getUsageSummaryHandler({ sinceMs: 0 });
    expect(summary.totalRuns).toBe(1);
    expect(summary.totalCostUsd).toBeCloseTo(0.2, 8);
  });
});
