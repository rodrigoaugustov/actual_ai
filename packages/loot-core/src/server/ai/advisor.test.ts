import type { AgentLoopDeps, AgentLoopResult } from '@actual-app/ai';
import type * as AiCore from '@actual-app/ai';

import { cancelAdvisorRun, startAdvisorRun } from './advisor';
import {
  appendConversationMessage,
  createConversation,
  listConversationMessages,
} from './advisor-memory';
import { setAiConfig } from './config';

const mocks = vi.hoisted(() => ({
  runAgentLoop: vi.fn(),
  send: vi.fn(),
  recordRun: vi.fn(),
}));

vi.mock('@actual-app/ai', async importOriginal => ({
  ...(await importOriginal<typeof AiCore>()),
  assertCanStartRun: vi.fn(),
  runAgentLoop: mocks.runAgentLoop,
}));
vi.mock('#platform/server/connection', () => ({ send: mocks.send }));
vi.mock('./fetch-client', () => ({
  buildProviderConfigForTier: vi.fn(async () => ({
    provider: 'anthropic',
    model: 'test-model',
    baseURL: 'http://localhost',
    fetch,
  })),
}));
vi.mock('./runs', () => ({
  getSpendTodayUsd: vi.fn(async () => 0),
  recordRun: mocks.recordRun,
}));

beforeEach(global.emptyDatabase());
beforeEach(async () => {
  mocks.runAgentLoop.mockReset();
  mocks.send.mockReset();
  mocks.recordRun.mockReset();
  mocks.recordRun.mockResolvedValue('database-run');
  await setAiConfig({
    enabled: true,
    tiers: {
      fast: { provider: 'anthropic', model: 'fast' },
      standard: { provider: 'anthropic', model: 'standard' },
      frontier: { provider: 'anthropic', model: 'frontier' },
    },
    confidenceThreshold: 0.8,
    redactPii: true,
  });
});

describe('advisor orchestration', () => {
  it('streams an answer and persists the completed assistant message', async () => {
    mocks.runAgentLoop.mockImplementation(
      async ({ deps }: { deps: AgentLoopDeps }): Promise<AgentLoopResult> => {
        await deps.onEvent?.({
          type: 'tool-call',
          toolCallId: 'analysis-1',
          toolName: 'run_financial_analysis',
          input: {
            dataset: 'transactions',
            dimensions: ['year_month'],
            filters: [
              {
                field: 'payee',
                operator: 'contains',
                value: 'beneficiário privado',
              },
            ],
          },
        });
        await deps.onEvent?.({
          type: 'tool-result',
          toolCallId: 'analysis-1',
          toolName: 'run_financial_analysis',
          input: {},
          output: {
            dataset: 'transactions',
            rows: [{ payee: 'beneficiário privado' }],
            coverage: {
              sourceRows: 10,
              resultRows: 1,
              returnedRows: 1,
              complete: true,
              hasMore: false,
            },
          },
        });
        await deps.onEvent?.({ type: 'text-delta', text: 'Resposta ' });
        await deps.onEvent?.({ type: 'text-delta', text: 'consultiva.' });
        return {
          text: 'Resposta consultiva.',
          steps: 1,
          run: {
            agent: 'advisor',
            tier: 'frontier',
            provider: 'anthropic',
            model: 'test-model',
            inputTokens: 10,
            outputTokens: 5,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            costUsd: 0.01,
            durationMs: 20,
            status: 'ok',
          },
        };
      },
    );
    const conversation = await createConversation();

    const outcome = await startAdvisorRun({
      conversationId: conversation.id,
      message: 'Como devo planejar?',
    });
    expect(outcome).toMatchObject({ status: 'completed' });

    await vi.waitFor(() => {
      expect(mocks.send).toHaveBeenCalledWith(
        'ai-advisor-event',
        expect.objectContaining({
          type: 'completed',
          conversationId: conversation.id,
        }),
      );
    });
    const storedMessages = await listConversationMessages(conversation.id);
    expect(storedMessages).toMatchObject([
      { role: 'user', content: 'Como devo planejar?' },
      {
        role: 'assistant',
        content: 'Resposta consultiva.',
        runId: 'database-run',
      },
    ]);
    const trace = storedMessages[1]?.parts.filter(
      part => part.type === 'trace',
    );
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'understanding',
          state: 'completed',
        }),
        expect.objectContaining({ kind: 'context', state: 'completed' }),
        expect.objectContaining({
          kind: 'tool',
          state: 'completed',
          toolName: 'run_financial_analysis',
        }),
        expect.objectContaining({
          kind: 'validation',
          detail: expect.objectContaining({
            sourceRows: 10,
            complete: true,
          }),
        }),
        expect.objectContaining({ kind: 'composing', state: 'completed' }),
      ]),
    );
    expect(JSON.stringify(trace)).not.toContain('beneficiário privado');
    expect(mocks.send).toHaveBeenCalledWith(
      'ai-advisor-event',
      expect.objectContaining({
        type: 'trace',
        conversationId: conversation.id,
      }),
    );
    expect(mocks.recordRun).toHaveBeenCalledOnce();
  });

  it('cancels an active run without persisting a partial answer', async () => {
    mocks.runAgentLoop.mockImplementation(
      ({ deps }: { deps: AgentLoopDeps }) =>
        new Promise((_resolve, reject) => {
          if (deps.abortSignal?.aborted) {
            reject(new Error('aborted'));
            return;
          }
          deps.abortSignal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );
    const conversation = await createConversation();
    await appendConversationMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Contexto anterior',
    });
    const startPromise = startAdvisorRun({
      conversationId: conversation.id,
      message: 'Pare esta resposta',
    });
    await vi.waitFor(() => {
      expect(mocks.send).toHaveBeenCalledWith(
        'ai-advisor-event',
        expect.objectContaining({ type: 'started' }),
      );
    });
    const startedEvent = mocks.send.mock.calls.find(
      call => call[1]?.type === 'started',
    )?.[1];
    expect(startedEvent?.runId).toEqual(expect.any(String));
    expect(cancelAdvisorRun(startedEvent.runId)).toBe(true);
    await expect(startPromise).resolves.toMatchObject({ status: 'completed' });
    await vi.waitFor(() => {
      expect(mocks.send).toHaveBeenCalledWith(
        'ai-advisor-event',
        expect.objectContaining({
          type: 'cancelled',
          runId: startedEvent.runId,
        }),
      );
    });
    expect(
      (await listConversationMessages(conversation.id)).filter(
        message => message.role === 'assistant',
      ),
    ).toEqual([]);
  });
});
