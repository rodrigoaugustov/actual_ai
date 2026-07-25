import {
  advisorAgent,
  assertCanStartRun,
  runAgentLoop,
  WorkflowError,
} from '@actual-app/ai';
import type { AgentLoopEvent, ModelMessage } from '@actual-app/ai';
import { v4 as uuidv4 } from 'uuid';

import * as connection from '#platform/server/connection';
import { logger } from '#platform/server/log';
import type {
  AiMessagePart,
  AiTraceDetail,
  AiTracePart,
  AiTraceState,
} from '#types/models/ai';

import {
  appendConversationMessage,
  getConversation,
  listConversationMessages,
  listGoals,
  listMemoryFacts,
  searchAdvisorContext,
  updateConversation,
} from './advisor-memory';
import { advisorToolSpecs, createAdvisorToolHandlers } from './advisor-tools';
import {
  summarizeAdvisorCoverage,
  summarizeAdvisorToolInput,
  summarizeAdvisorToolResult,
} from './advisor-trace';
import { getAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';
import { getSpendTodayUsd, recordRun } from './runs';

const MAX_USER_MESSAGE_LENGTH = 8_000;
const MAX_HISTORY_MESSAGES = 30;
const activeRuns = new Map<string, AbortController>();

export type StartAdvisorRunOutcome =
  | { status: 'disabled' }
  | { status: 'budget-exceeded' }
  | { status: 'not-found' }
  | { status: 'completed'; runId: string };

function emit(
  event: Parameters<typeof connection.send<'ai-advisor-event'>>[1],
): void {
  connection.send('ai-advisor-event', event);
}

function buildProfileContext(
  memories: Awaited<ReturnType<typeof listMemoryFacts>>,
  goals: Awaited<ReturnType<typeof listGoals>>,
  retrieved: Awaited<ReturnType<typeof searchAdvisorContext>>,
): string {
  const blocks = [
    memories.length > 0
      ? `Memórias confirmadas pelo usuário:\n${memories
          .map(memory => `- ${memory.kind}: ${JSON.stringify(memory.value)}`)
          .join('\n')}`
      : 'Não há memórias pessoais confirmadas.',
    goals.length > 0
      ? `Objetivos registrados:\n${goals
          .filter(goal => goal.status === 'active' || goal.status === 'paused')
          .map(
            goal =>
              `- ${goal.title}: ${goal.description} (prioridade ${goal.priority}, status ${goal.status})`,
          )
          .join('\n')}`
      : 'Não há objetivos registrados.',
    retrieved.length > 0
      ? `Contexto recuperado para esta pergunta:\n${retrieved
          .map(
            match =>
              `- [${match.sourceType}:${match.sourceId}] ${match.title}: ${match.content}`,
          )
          .join('\n')}`
      : '',
  ];
  return blocks.filter(Boolean).join('\n\n');
}

function toModelMessages(
  messages: Awaited<ReturnType<typeof listConversationMessages>>,
): ModelMessage[] {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES)
    .map(message => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));
}

async function refreshConversationSummary(
  conversationId: string,
): Promise<void> {
  const messages = await listConversationMessages(conversationId);
  const recent = messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map(
      message =>
        `${message.role === 'user' ? 'Usuário' : 'Consultor'}: ${message.content}`,
    )
    .join('\n');
  await updateConversation({
    id: conversationId,
    summary: recent.slice(0, 4_000),
  });
}

async function executeAdvisorRun(params: {
  runId: string;
  conversationId: string;
  userMessage: string;
  abortController: AbortController;
}): Promise<void> {
  const { runId, conversationId, userMessage, abortController } = params;
  const config = getAiConfig();
  const parts: AiMessagePart[] = [];
  const publishTrace = (trace: AiTracePart): void => {
    const existingIndex = parts.findIndex(
      part => part.type === 'trace' && part.id === trace.id,
    );
    if (existingIndex === -1) {
      parts.push(trace);
    } else {
      parts[existingIndex] = trace;
    }
    emit({ type: 'trace', runId, conversationId, trace });
  };
  const startTrace = (
    trace: Omit<AiTracePart, 'type' | 'state' | 'startedAt'>,
  ): void => {
    publishTrace({
      ...trace,
      type: 'trace',
      state: 'running',
      startedAt: Date.now(),
    });
  };
  const updateTrace = (
    id: string,
    state: AiTraceState,
    detail?: AiTraceDetail,
  ): void => {
    const existing = parts.find(
      (part): part is AiTracePart => part.type === 'trace' && part.id === id,
    );
    if (!existing) return;
    publishTrace({
      ...existing,
      state,
      completedAt: state === 'running' ? undefined : Date.now(),
      detail:
        existing.detail || detail
          ? { ...existing.detail, ...detail }
          : undefined,
    });
  };
  const failRunningTraces = (): void => {
    for (const part of [...parts]) {
      if (part.type === 'trace' && part.state === 'running') {
        updateTrace(part.id, 'error');
      }
    }
  };
  let hasStartedComposing = false;
  let hasCompletedPlanning = false;
  const completePlanning = (): void => {
    if (!hasCompletedPlanning) {
      hasCompletedPlanning = true;
      updateTrace('planning', 'completed');
    }
  };

  try {
    emit({ type: 'started', runId, conversationId });
    startTrace({ id: 'understanding', kind: 'understanding' });
    const userRecord = await appendConversationMessage({
      conversationId,
      role: 'user',
      content: userMessage,
      parts: [{ type: 'text', text: userMessage }],
    });
    const conversation = await getConversation(conversationId);
    if (conversation?.title === 'Nova conversa') {
      await updateConversation({
        id: conversationId,
        title: userMessage.replace(/\s+/g, ' ').slice(0, 60),
      });
    }
    updateTrace('understanding', 'completed');

    startTrace({ id: 'context', kind: 'context' });
    const [messages, memories, goals, retrieved, providerConfig] =
      await Promise.all([
        listConversationMessages(conversationId),
        listMemoryFacts('confirmed').then(items => {
          const now = Date.now();
          return items.filter(
            item =>
              (config.shareSensitiveMemoryWithProvider ||
                item.sensitivity === 'normal') &&
              (item.validFrom == null || item.validFrom <= now) &&
              (item.validTo == null || item.validTo > now),
          );
        }),
        listGoals(),
        searchAdvisorContext(
          userMessage,
          8,
          config.shareSensitiveMemoryWithProvider,
        ),
        buildProviderConfigForTier(advisorAgent.tier),
      ]);
    updateTrace('context', 'completed', {
      memoryCount: memories.length,
      goalCount: goals.length,
      sourceCount: retrieved.length,
    });
    for (const match of retrieved) {
      parts.push({
        type: 'source',
        sourceType: match.sourceType === 'document' ? 'document' : 'memory',
        sourceId: match.sourceId,
        title: match.title,
        excerpt: match.content.slice(0, 240),
      });
    }
    startTrace({ id: 'planning', kind: 'planning' });
    const result = await runAgentLoop({
      agent: advisorAgent,
      messages: toModelMessages(messages),
      context: buildProfileContext(memories, goals, retrieved),
      deps: {
        config: providerConfig,
        tools: advisorToolSpecs,
        handlers: createAdvisorToolHandlers({
          conversationId,
          includeSensitiveMemory:
            config.shareSensitiveMemoryWithProvider ?? false,
          sourceMessageId: userRecord.id,
        }),
        approvedWriteTools: ['propose_memory', 'propose_advice'],
        abortSignal: abortController.signal,
        onEvent: async (event: AgentLoopEvent) => {
          if (event.type === 'text-delta') {
            completePlanning();
            if (!hasStartedComposing) {
              hasStartedComposing = true;
              startTrace({ id: 'composing', kind: 'composing' });
            }
            emit({
              type: 'text-delta',
              runId,
              conversationId,
              text: event.text,
            });
          } else if (event.type === 'tool-call') {
            completePlanning();
            parts.push({
              type: 'tool',
              toolName: event.toolName,
              state: 'call',
              input: event.input,
            });
            startTrace({
              id: `tool:${event.toolCallId}`,
              kind: 'tool',
              toolName: event.toolName,
              detail: summarizeAdvisorToolInput(event.toolName, event.input),
            });
            emit({
              type: 'tool-call',
              runId,
              conversationId,
              toolName: event.toolName,
            });
          } else if (event.type === 'tool-result') {
            parts.push({
              type: 'tool',
              toolName: event.toolName,
              state: 'result',
              input: event.input,
              output: event.output,
            });
            updateTrace(
              `tool:${event.toolCallId}`,
              'completed',
              summarizeAdvisorToolResult(event.output),
            );
            const coverage = summarizeAdvisorCoverage(event.output);
            if (coverage) {
              const now = Date.now();
              publishTrace({
                type: 'trace',
                id: `validation:${event.toolCallId}`,
                kind: 'validation',
                state: 'completed',
                toolName: event.toolName,
                startedAt: now,
                completedAt: now,
                detail: coverage,
              });
            }
            emit({
              type: 'tool-result',
              runId,
              conversationId,
              toolName: event.toolName,
            });
            if (
              event.toolName === 'propose_memory' &&
              event.output &&
              typeof event.output === 'object' &&
              'candidateId' in event.output &&
              typeof event.output.candidateId === 'string'
            ) {
              emit({
                type: 'memory-candidate',
                runId,
                conversationId,
                candidateId: event.output.candidateId,
              });
            }
          } else if (event.type === 'tool-error') {
            parts.push({
              type: 'tool',
              toolName: event.toolName,
              state: 'error',
              input: event.input,
              output: event.error,
            });
            updateTrace(`tool:${event.toolCallId}`, 'error');
          } else if (event.type === 'tool-repair') {
            const traceId = `retry:${event.toolCallId}:${event.attempt}`;
            if (event.state === 'started') {
              startTrace({
                id: traceId,
                kind: 'retry',
                toolName: event.toolName,
                detail: { attempt: event.attempt },
              });
            } else {
              updateTrace(
                traceId,
                event.state === 'completed' ? 'completed' : 'error',
              );
            }
          } else if (event.type === 'tool-follow-up') {
            const now = Date.now();
            publishTrace({
              type: 'trace',
              id: `follow-up:${event.after}:${event.toolName}`,
              kind: 'planning',
              state: 'completed',
              toolName: event.toolName,
              startedAt: now,
              completedAt: now,
            });
          } else if (event.type === 'response-recovery') {
            const traceId = 'retry:response';
            if (event.state === 'started') {
              startTrace({ id: traceId, kind: 'retry' });
            } else {
              updateTrace(traceId, 'completed');
            }
          }
        },
      },
    });
    completePlanning();
    if (hasStartedComposing) {
      updateTrace('composing', 'completed');
    }
    const recordedRunId = await recordRun(result.run);
    const assistantMessage = await appendConversationMessage({
      conversationId,
      role: 'assistant',
      content: result.text,
      parts: [{ type: 'text', text: result.text }, ...parts],
      runId: recordedRunId,
    });
    await refreshConversationSummary(conversationId);
    emit({
      type: 'completed',
      runId,
      conversationId,
      messageId: assistantMessage.id,
    });
  } catch (error) {
    failRunningTraces();
    if (error instanceof WorkflowError) {
      await recordRun(error.run);
    }
    if (abortController.signal.aborted) {
      emit({ type: 'cancelled', runId, conversationId });
    } else {
      logger.warn('AI advisor run failed:', error);
      emit({
        type: 'error',
        runId,
        conversationId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } finally {
    activeRuns.delete(runId);
  }
}

export async function startAdvisorRun(params: {
  conversationId: string;
  message: string;
}): Promise<StartAdvisorRunOutcome> {
  const config = getAiConfig();
  if (!config.enabled) return { status: 'disabled' };
  if (!(await getConversation(params.conversationId))) {
    return { status: 'not-found' };
  }
  try {
    assertCanStartRun(
      { maxCostPerDayUsd: config.maxCostPerDayUsd },
      await getSpendTodayUsd(),
    );
  } catch {
    return { status: 'budget-exceeded' };
  }

  const message = params.message.trim();
  if (!message || message.length > MAX_USER_MESSAGE_LENGTH) {
    throw new Error('A mensagem deve ter entre 1 e 8.000 caracteres.');
  }
  const runId = uuidv4();
  const abortController = new AbortController();
  activeRuns.set(runId, abortController);
  await executeAdvisorRun({
    runId,
    conversationId: params.conversationId,
    userMessage: message,
    abortController,
  });
  return { status: 'completed', runId };
}

export function cancelAdvisorRun(runId: string): boolean {
  const active = activeRuns.get(runId);
  if (!active) return false;
  active.abort();
  return true;
}
