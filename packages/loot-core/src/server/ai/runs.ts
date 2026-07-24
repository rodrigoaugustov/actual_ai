import type { RunRecord } from '@actual-app/ai';

import * as db from '#server/db';
import type { DbAiRun } from '#server/db';
import type { AiRunEntity } from '#types/models/ai';

export async function recordRun(run: RunRecord): Promise<string> {
  return db.insertWithUUID('ai_runs', {
    agent: run.agent,
    tier: run.tier,
    provider: run.provider,
    model: run.model,
    input_tokens: run.inputTokens,
    output_tokens: run.outputTokens,
    cache_read_tokens: run.cacheReadTokens,
    cache_write_tokens: run.cacheWriteTokens,
    cost_usd: run.costUsd,
    duration_ms: run.durationMs,
    status: run.status,
    error: run.error ?? null,
    created_at: Date.now(),
    tombstone: 0,
  });
}

function startOfTodayMs(): number {
  // Built from Date.now() (not the bare `new Date()` constructor) so this
  // stays consistent with `recordRun`'s `created_at: Date.now()` under any
  // mocked clock (e.g. the fixed Date.now() the test suite installs).
  const startOfDay = new Date(Date.now());
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay.getTime();
}

export async function getSpendTodayUsd(): Promise<number> {
  const row = await db.first<{ total: number | null }>(
    'SELECT SUM(cost_usd) as total FROM ai_runs WHERE created_at >= ? AND tombstone = 0',
    [startOfTodayMs()],
  );
  return row?.total ?? 0;
}

export type UsageSummary = {
  totalCostUsd: number;
  totalRuns: number;
  byAgent: Record<string, number>;
};

const RECENT_RUNS_LIMIT = 200;

/** Most recent runs across all agents, newest first — the raw material for
 * the AI usage/observability page (tokens, model, duration, cost per call),
 * so users can judge which provider/model is actually worth the spend. */
export async function getRecentRuns(): Promise<AiRunEntity[]> {
  const rows = await db.all<DbAiRun>(
    'SELECT * FROM ai_runs WHERE tombstone = 0 ORDER BY created_at DESC LIMIT ?',
    [RECENT_RUNS_LIMIT],
  );
  return rows.map(row => ({
    id: row.id,
    agent: row.agent,
    tier: row.tier as AiRunEntity['tier'],
    provider: row.provider as AiRunEntity['provider'],
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    status: row.status as AiRunEntity['status'],
    error: row.error,
    createdAt: row.created_at,
  }));
}

export async function getUsageSummary(sinceMs: number): Promise<UsageSummary> {
  const rows = await db.all<Pick<DbAiRun, 'agent' | 'cost_usd'>>(
    'SELECT agent, cost_usd FROM ai_runs WHERE created_at >= ? AND tombstone = 0',
    [sinceMs],
  );

  const byAgent: Record<string, number> = {};
  let totalCostUsd = 0;
  for (const row of rows) {
    totalCostUsd += row.cost_usd;
    byAgent[row.agent] = (byAgent[row.agent] ?? 0) + row.cost_usd;
  }

  return { totalCostUsd, totalRuns: rows.length, byAgent };
}
