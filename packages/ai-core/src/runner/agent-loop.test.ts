import type * as Ai from 'ai';
import type { LanguageModelUsage } from 'ai';
import { z } from 'zod';

import { advisorAgent } from '#agents/advisor';
import type * as Providers from '#providers/registry';

import { runAgentLoop } from './agent-loop';

const buildModelMock = vi.fn();
const generateTextMock = vi.fn();
const streamTextMock = vi.fn();

vi.mock('#providers/registry', async () => {
  const actual = await vi.importActual<typeof Providers>('#providers/registry');
  return {
    ...actual,
    buildModel: (...args: unknown[]) => buildModelMock(...args),
  };
});

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof Ai>('ai');
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
    streamText: (...args: unknown[]) => streamTextMock(...args),
  };
});

const usage = {
  inputTokens: 10,
  inputTokenDetails: {
    noCacheTokens: 10,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokens: 5,
  outputTokenDetails: { textTokens: 5, reasoningTokens: 0 },
  totalTokens: 15,
} satisfies LanguageModelUsage;

beforeEach(() => {
  buildModelMock.mockReset();
  generateTextMock.mockReset();
  streamTextMock.mockReset();
  buildModelMock.mockReturnValue({ modelId: 'test' });
});

describe('runAgentLoop', () => {
  it('streams text and tool activity and returns a consolidated run', async () => {
    async function* stream() {
      yield { type: 'text-delta', id: 'text', text: 'Olá' };
      yield {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'snapshot',
        input: {},
      };
      yield {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'snapshot',
        input: {},
        output: { total: 100 },
      };
      yield {
        type: 'finish-step',
        usage,
        finishReason: 'tool-calls',
      };
      yield {
        type: 'text-delta',
        id: 'text-2',
        text: ' mundo',
      };
      yield {
        type: 'finish-step',
        usage,
        finishReason: 'stop',
      };
      yield { type: 'finish', finishReason: 'stop', totalUsage: usage };
    }
    streamTextMock.mockReturnValue({ stream: stream(), usage });
    const events: unknown[] = [];

    const result = await runAgentLoop({
      agent: advisorAgent,
      messages: [{ role: 'user', content: 'Como estou?' }],
      deps: {
        config: {
          provider: 'anthropic',
          model: 'test-model',
          baseURL: 'http://localhost',
          fetch,
        },
        tools: [
          {
            name: 'snapshot',
            description: 'Snapshot',
            inputSchema: z.object({}),
            access: 'read',
          },
        ],
        handlers: { snapshot: async () => ({ total: 100 }) },
        onEvent: event => {
          events.push(event);
        },
      },
    });

    expect(result).toMatchObject({
      text: 'Olá mundo',
      steps: 2,
      run: { agent: 'advisor', status: 'ok' },
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-call', toolName: 'snapshot' }),
        expect.objectContaining({ type: 'tool-result', toolName: 'snapshot' }),
        expect.objectContaining({ type: 'finish', finishReason: 'stop' }),
      ]),
    );
  });

  it('fails closed when a write tool is not approved', async () => {
    async function* stream() {
      yield await Promise.reject(
        new Error('Write tool requires explicit approval: mutate'),
      );
    }
    streamTextMock.mockReturnValue({ stream: stream(), usage });

    await expect(
      runAgentLoop({
        agent: advisorAgent,
        messages: [{ role: 'user', content: 'Mude algo' }],
        deps: {
          config: {
            provider: 'anthropic',
            model: 'test-model',
            baseURL: 'http://localhost',
            fetch,
          },
          tools: [
            {
              name: 'mutate',
              description: 'Mutate',
              inputSchema: z.object({}),
              access: 'write',
            },
          ],
          handlers: { mutate: async () => null },
        },
      }),
    ).rejects.toThrow('Write tool requires explicit approval');
  });

  it('preserves provider errors carried by the full stream', async () => {
    async function* stream() {
      yield {
        type: 'error',
        error: new Error(
          'Function tools with reasoning_effort require /v1/responses.',
        ),
      };
    }
    streamTextMock.mockReturnValue({ stream: stream(), usage });

    await expect(
      runAgentLoop({
        agent: advisorAgent,
        messages: [{ role: 'user', content: 'Como estou?' }],
        deps: {
          config: {
            provider: 'openai',
            model: 'gpt-5.6-luna',
            baseURL: 'http://localhost',
            fetch,
          },
          tools: [],
          handlers: {},
        },
      }),
    ).rejects.toThrow(
      'Function tools with reasoning_effort require /v1/responses.',
    );
  });

  it('repairs an invalid tool input with the registered schema', async () => {
    async function* stream() {
      yield { type: 'text-delta', id: 'text', text: 'Concluído' };
      yield { type: 'finish', finishReason: 'stop', totalUsage: usage };
    }
    let streamOptions: Record<string, unknown> | undefined;
    streamTextMock.mockImplementation((options: Record<string, unknown>) => {
      streamOptions = options;
      return { stream: stream(), usage };
    });
    generateTextMock.mockResolvedValue({ output: { month: '2026-07' } });
    const repairEvents: unknown[] = [];

    await runAgentLoop({
      agent: advisorAgent,
      messages: [{ role: 'user', content: 'Analise julho' }],
      deps: {
        config: {
          provider: 'ollama',
          model: 'test-model',
          baseURL: 'http://localhost',
          fetch,
        },
        tools: [
          {
            name: 'budget',
            description: 'Budget',
            inputSchema: z.object({
              month: z.string().regex(/^\d{4}-\d{2}$/),
            }),
            access: 'read',
          },
        ],
        handlers: { budget: async () => ({ total: 100 }) },
        onEvent: event => {
          repairEvents.push(event);
        },
      },
    });

    const repairToolCall = streamOptions?.repairToolCall;
    const tools = streamOptions?.tools;
    expect(repairToolCall).toBeTypeOf('function');
    expect(tools).toBeTypeOf('object');
    const repaired = await (
      repairToolCall as (options: {
        toolCall: {
          type: 'tool-call';
          toolCallId: string;
          toolName: string;
          input: string;
        };
        tools: Record<string, unknown>;
        inputSchema: (options: { toolName: string }) => Promise<unknown>;
        error: Error;
      }) => Promise<unknown>
    )({
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'budget',
        input: '{"month":"julho"}',
      },
      tools: tools as Record<string, unknown>,
      inputSchema: async () => ({
        type: 'object',
        properties: { month: { type: 'string' } },
      }),
      error: new Error('Invalid tool input'),
    });

    expect(repaired).toMatchObject({
      toolName: 'budget',
      input: '{"month":"2026-07"}',
    });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(repairEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-repair',
          toolName: 'budget',
          state: 'started',
        }),
        expect.objectContaining({
          type: 'tool-repair',
          toolName: 'budget',
          state: 'completed',
        }),
      ]),
    );
  });

  it('forces a configured follow-up tool after its prerequisite', async () => {
    async function* stream() {
      yield { type: 'text-delta', id: 'text', text: 'Concluído' };
      yield { type: 'finish', finishReason: 'stop', totalUsage: usage };
    }
    let streamOptions: Record<string, unknown> | undefined;
    streamTextMock.mockImplementation((options: Record<string, unknown>) => {
      streamOptions = options;
      return { stream: stream(), usage };
    });
    const followUpEvents: unknown[] = [];

    await runAgentLoop({
      agent: advisorAgent,
      messages: [{ role: 'user', content: 'Analise meu fluxo' }],
      deps: {
        config: {
          provider: 'ollama',
          model: 'test-model',
          baseURL: 'http://localhost',
          fetch,
        },
        tools: [
          {
            name: 'describe_financial_data',
            description: 'Catalog',
            inputSchema: z.object({}),
            access: 'read',
          },
          {
            name: 'run_financial_analysis',
            description: 'Analyze',
            inputSchema: z.object({ dataset: z.string() }),
            access: 'read',
          },
        ],
        handlers: {
          describe_financial_data: async () => ({}),
          run_financial_analysis: async () => ({}),
        },
        onEvent: event => {
          followUpEvents.push(event);
        },
      },
    });

    const prepareStep = streamOptions?.prepareStep;
    expect(prepareStep).toBeTypeOf('function');
    const nextStep = await (
      prepareStep as (options: {
        steps: Array<{
          toolCalls: Array<{ toolName: string }>;
        }>;
      }) => Promise<unknown> | unknown
    )({
      steps: [
        {
          toolCalls: [{ toolName: 'describe_financial_data' }],
        },
      ],
    });
    expect(nextStep).toEqual({
      activeTools: ['run_financial_analysis'],
      toolChoice: {
        type: 'tool',
        toolName: 'run_financial_analysis',
      },
    });
    expect(followUpEvents).toContainEqual({
      type: 'tool-follow-up',
      after: 'describe_financial_data',
      toolName: 'run_financial_analysis',
    });
  });

  it('continues once without tools when a provider stops after tool output', async () => {
    async function* toolOnlyStream() {
      yield {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'snapshot',
        input: {},
      };
      yield {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'snapshot',
        input: {},
        output: { total: 100 },
      };
      yield { type: 'finish-step', usage, finishReason: 'tool-calls' };
      yield { type: 'finish', finishReason: 'stop', totalUsage: usage };
    }
    async function* recoveryStream() {
      yield { type: 'text-delta', id: 'text', text: 'Resposta recuperada' };
      yield { type: 'finish-step', usage, finishReason: 'stop' };
      yield { type: 'finish', finishReason: 'stop', totalUsage: usage };
    }
    streamTextMock
      .mockReturnValueOnce({
        stream: toolOnlyStream(),
        usage,
        response: Promise.resolve({
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'snapshot',
                  input: {},
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'snapshot',
                  output: { type: 'json', value: { total: 100 } },
                },
              ],
            },
          ],
        }),
      })
      .mockReturnValueOnce({
        stream: recoveryStream(),
        usage,
      });

    const recoveryEvents: unknown[] = [];
    const result = await runAgentLoop({
      agent: advisorAgent,
      messages: [{ role: 'user', content: 'Como estou?' }],
      deps: {
        config: {
          provider: 'ollama',
          model: 'test-model',
          baseURL: 'http://localhost',
          fetch,
        },
        tools: [
          {
            name: 'snapshot',
            description: 'Snapshot',
            inputSchema: z.object({}),
            access: 'read',
          },
        ],
        handlers: { snapshot: async () => ({ total: 100 }) },
        onEvent: event => {
          recoveryEvents.push(event);
        },
      },
    });

    expect(result).toMatchObject({
      text: 'Resposta recuperada',
      steps: 2,
      run: {
        inputTokens: 20,
        outputTokens: 10,
      },
    });
    expect(streamTextMock).toHaveBeenCalledTimes(2);
    expect(streamTextMock.mock.calls[1]?.[0]).toMatchObject({
      toolChoice: 'none',
    });
    expect(recoveryEvents).toEqual(
      expect.arrayContaining([
        { type: 'response-recovery', state: 'started' },
        { type: 'response-recovery', state: 'completed' },
      ]),
    );
  });
});
