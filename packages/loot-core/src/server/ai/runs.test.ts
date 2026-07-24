import type { RunRecord } from '@actual-app/ai';

import { getSpendTodayUsd, getUsageSummary, recordRun } from './runs';

beforeEach(global.emptyDatabase());

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    agent: 'classifier',
    tier: 'standard',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    inputTokens: 100,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.05,
    durationMs: 200,
    status: 'ok',
    ...overrides,
  };
}

describe('recordRun / getSpendTodayUsd / getUsageSummary', () => {
  it('reports zero spend with no runs recorded', async () => {
    expect(await getSpendTodayUsd()).toBe(0);
  });

  it('accumulates cost across recorded runs for today', async () => {
    await recordRun(makeRun({ costUsd: 0.1 }));
    await recordRun(makeRun({ costUsd: 0.25 }));

    expect(await getSpendTodayUsd()).toBeCloseTo(0.35, 8);
  });

  it('summarizes usage by agent since a given timestamp', async () => {
    await recordRun(makeRun({ agent: 'classifier', costUsd: 0.1 }));
    await recordRun(makeRun({ agent: 'classifier', costUsd: 0.2 }));
    await recordRun(makeRun({ agent: 'rule-miner', costUsd: 0.05 }));

    const summary = await getUsageSummary(0);

    expect(summary.totalRuns).toBe(3);
    expect(summary.totalCostUsd).toBeCloseTo(0.35, 8);
    expect(summary.byAgent.classifier).toBeCloseTo(0.3, 8);
    expect(summary.byAgent['rule-miner']).toBeCloseTo(0.05, 8);
  });

  it('excludes runs recorded before the summary window', async () => {
    await recordRun(makeRun({ costUsd: 0.1 }));

    const future = Date.now() + 10_000;
    const summary = await getUsageSummary(future);

    expect(summary.totalRuns).toBe(0);
    expect(summary.totalCostUsd).toBe(0);
  });
});
