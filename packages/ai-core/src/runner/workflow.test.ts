import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import * as registry from '#providers/registry';
import type { AgentDefinition, ProviderConfig } from '#types';

import { runWorkflow, WorkflowError } from './workflow';

const config: ProviderConfig = {
  provider: 'anthropic',
  model: 'test-model',
  baseURL: 'https://proxy.example.com/ai/proxy/anthropic',
  fetch: vi.fn() as unknown as typeof fetch,
};

const agent: AgentDefinition<{ payee: string }, { category: string }> = {
  name: 'test-agent',
  tier: 'standard',
  buildPrompt: input => [
    { role: 'system', text: 'Classify the transaction.', cacheable: true },
    { role: 'user', text: `Payee: ${input.payee}` },
  ],
  outputSchema: z.object({ category: z.string() }),
};

function mockUsage() {
  return {
    inputTokens: { total: 100, noCache: 80, cacheRead: 20, cacheWrite: 0 },
    outputTokens: { total: 10, text: 10, reasoning: 0 },
  };
}

describe('runWorkflow', () => {
  it('parses the structured output and builds a cost run record', async () => {
    vi.spyOn(registry, 'buildModel').mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: async () => ({
          content: [{ type: 'text', text: `{"category":"Groceries"}` }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: mockUsage(),
          warnings: [],
        }),
      }),
    );

    const result = await runWorkflow(agent, { payee: 'Extra' }, { config });

    expect(result.output).toEqual({ category: 'Groceries' });
    expect(result.run).toMatchObject({
      agent: 'test-agent',
      tier: 'standard',
      provider: 'anthropic',
      model: 'test-model',
      status: 'ok',
      inputTokens: 100,
      outputTokens: 10,
      cacheReadTokens: 20,
    });
  });

  it('wraps a failed call in WorkflowError carrying a zeroed-usage run record', async () => {
    vi.spyOn(registry, 'buildModel').mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new Error('provider unavailable');
        },
      }),
    );

    await expect(
      runWorkflow(agent, { payee: 'Extra' }, { config }),
    ).rejects.toThrow(WorkflowError);

    try {
      await runWorkflow(agent, { payee: 'Extra' }, { config });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowError);
      const workflowError = error as WorkflowError;
      expect(workflowError.run.status).toBe('error');
      expect(workflowError.run.error).toContain('provider unavailable');
      expect(workflowError.run.costUsd).toBe(0);
    }
  });
});
