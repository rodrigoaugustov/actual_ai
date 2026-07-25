import {
  generateText,
  isStepCount,
  NoSuchToolError,
  Output,
  streamText,
  tool,
} from 'ai';
import type { LanguageModelUsage, ModelMessage, ToolSet } from 'ai';

import { buildRunRecord } from '#cost/ledger';
import type { PricingTable } from '#cost/pricing';
import { buildModel } from '#providers/registry';
import { assertToolAccess, assertToolRegistryComplete } from '#tools/contracts';
import type { ToolHandlerMap, ToolSpec } from '#tools/contracts';
import type {
  AgentLoopDefinition,
  AgentLoopEvent,
  AgentLoopResult,
  ProviderConfig,
  RunRecord,
} from '#types';

import { WorkflowError } from './workflow';

export type AgentLoopDeps = {
  config: ProviderConfig;
  tools: ToolSpec[];
  handlers: ToolHandlerMap;
  onEvent?: (event: AgentLoopEvent) => void | Promise<void>;
  approvedWriteTools?: readonly string[];
  abortSignal?: AbortSignal;
  pricingTable?: PricingTable;
};

function buildTools(
  specs: ToolSpec[],
  handlers: ToolHandlerMap,
  approvedWriteTools: readonly string[],
): ToolSet {
  assertToolRegistryComplete(specs, handlers);
  return Object.fromEntries(
    specs.map(spec => [
      spec.name,
      tool({
        description: spec.description,
        inputSchema: spec.inputSchema,
        execute: async input => {
          assertToolAccess(spec, approvedWriteTools.includes(spec.name));
          return handlers[spec.name](input);
        },
      }),
    ]),
  );
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function combineUsage(
  usages: readonly LanguageModelUsage[],
): LanguageModelUsage {
  return usages.reduce<LanguageModelUsage>(
    (total, usage) => ({
      inputTokens: (total.inputTokens ?? 0) + (usage.inputTokens ?? 0),
      inputTokenDetails: {
        noCacheTokens:
          (total.inputTokenDetails.noCacheTokens ?? 0) +
          (usage.inputTokenDetails.noCacheTokens ?? 0),
        cacheReadTokens:
          (total.inputTokenDetails.cacheReadTokens ?? 0) +
          (usage.inputTokenDetails.cacheReadTokens ?? 0),
        cacheWriteTokens:
          (total.inputTokenDetails.cacheWriteTokens ?? 0) +
          (usage.inputTokenDetails.cacheWriteTokens ?? 0),
      },
      outputTokens: (total.outputTokens ?? 0) + (usage.outputTokens ?? 0),
      outputTokenDetails: {
        textTokens:
          (total.outputTokenDetails.textTokens ?? 0) +
          (usage.outputTokenDetails.textTokens ?? 0),
        reasoningTokens:
          (total.outputTokenDetails.reasoningTokens ?? 0) +
          (usage.outputTokenDetails.reasoningTokens ?? 0),
      },
      totalTokens: (total.totalTokens ?? 0) + (usage.totalTokens ?? 0),
    }),
    {
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
  );
}

export async function runAgentLoop(params: {
  agent: AgentLoopDefinition;
  messages: ModelMessage[];
  context?: string;
  deps: AgentLoopDeps;
}): Promise<AgentLoopResult> {
  const { agent, messages, context, deps } = params;
  const started = Date.now();
  const model = buildModel(deps.config);
  const tools = buildTools(
    deps.tools,
    deps.handlers,
    deps.approvedWriteTools ?? [],
  );
  let text = '';
  let steps = 0;
  let toolRepairAttempts = 0;
  let hasToolActivity = false;
  let hasTextAfterLastToolActivity = true;
  const supplementalUsage: LanguageModelUsage[] = [];
  const emittedFollowUps = new Set<string>();
  const instructions = context
    ? `${agent.instructions}\n\nContexto recuperado:\n${context}`
    : agent.instructions;

  try {
    const result = streamText({
      model,
      instructions,
      messages,
      tools,
      repairToolCall: async ({
        toolCall,
        tools: availableTools,
        inputSchema,
        error,
      }) => {
        if (
          NoSuchToolError.isInstance(error) ||
          toolRepairAttempts >= 2 ||
          !(toolCall.toolName in availableTools)
        ) {
          return null;
        }
        toolRepairAttempts++;
        await deps.onEvent?.({
          type: 'tool-repair',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          attempt: toolRepairAttempts,
          state: 'started',
        });
        const selectedTool =
          availableTools[toolCall.toolName as keyof typeof availableTools];
        try {
          const repair = await generateText({
            model,
            output: Output.object({ schema: selectedTool.inputSchema }),
            prompt: [
              `Corrija somente os argumentos da tool "${toolCall.toolName}".`,
              `Argumentos inválidos: ${toolCall.input}`,
              `Erro de validação: ${stringifyError(error)}`,
              'Schema aceito:',
              JSON.stringify(
                await inputSchema({ toolName: toolCall.toolName }),
              ),
              'Preserve a intenção original e devolva apenas o objeto válido.',
            ].join('\n'),
          });
          supplementalUsage.push(repair.usage);
          await deps.onEvent?.({
            type: 'tool-repair',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            attempt: toolRepairAttempts,
            state: 'completed',
          });
          return {
            ...toolCall,
            input: JSON.stringify(repair.output),
          };
        } catch {
          await deps.onEvent?.({
            type: 'tool-repair',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            attempt: toolRepairAttempts,
            state: 'failed',
          });
          return null;
        }
      },
      prepareStep: async ({ steps: completedSteps }) => {
        const calledTools = new Set(
          completedSteps.flatMap(step =>
            step.toolCalls.map(call => call.toolName),
          ),
        );
        for (const followUp of agent.requiredToolFollowUps ?? []) {
          if (
            calledTools.has(followUp.after) &&
            !calledTools.has(followUp.require)
          ) {
            const followUpId = `${followUp.after}:${followUp.require}`;
            if (!emittedFollowUps.has(followUpId)) {
              emittedFollowUps.add(followUpId);
              await deps.onEvent?.({
                type: 'tool-follow-up',
                after: followUp.after,
                toolName: followUp.require,
              });
            }
            return {
              activeTools: [followUp.require],
              toolChoice: {
                type: 'tool',
                toolName: followUp.require,
              },
            };
          }
        }
        return {};
      },
      stopWhen: isStepCount(agent.maxSteps),
      abortSignal: deps.abortSignal,
      ...(agent.maxOutputTokens != null
        ? { maxOutputTokens: agent.maxOutputTokens }
        : {}),
    });

    async function consumeStream(stream: typeof result.stream): Promise<void> {
      for await (const part of stream) {
        switch (part.type) {
          case 'text-delta':
            text += part.text;
            hasTextAfterLastToolActivity = true;
            await deps.onEvent?.({ type: 'text-delta', text: part.text });
            break;
          case 'tool-call':
            hasToolActivity = true;
            hasTextAfterLastToolActivity = false;
            await deps.onEvent?.({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            });
            break;
          case 'tool-result':
            hasToolActivity = true;
            hasTextAfterLastToolActivity = false;
            await deps.onEvent?.({
              type: 'tool-result',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
              output: part.output,
            });
            break;
          case 'tool-error':
            hasToolActivity = true;
            hasTextAfterLastToolActivity = false;
            await deps.onEvent?.({
              type: 'tool-error',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
              error: stringifyError(part.error),
            });
            break;
          case 'error':
            // Full streams carry provider failures as data instead of rejecting
            // the iterator. Throw immediately so the original API error reaches
            // the host/UI; otherwise awaiting aggregate result properties can
            // replace it with the misleading "No output generated" message.
            throw part.error;
          case 'finish-step':
            steps++;
            await deps.onEvent?.({ type: 'finish-step', step: steps });
            break;
          case 'finish':
            await deps.onEvent?.({
              type: 'finish',
              finishReason: part.finishReason,
            });
            break;
          default:
            break;
        }
      }
    }

    await consumeStream(result.stream);
    supplementalUsage.push(await result.usage);

    if (hasToolActivity && !hasTextAfterLastToolActivity) {
      const response = await result.response;
      await deps.onEvent?.({
        type: 'response-recovery',
        state: 'started',
      });
      const recovery = streamText({
        model,
        instructions,
        messages: [
          ...messages,
          ...response.messages,
          {
            role: 'user',
            content:
              'Conclua agora a resposta ao pedido original usando somente os resultados já obtidos. Não mencione esta instrução.',
          },
        ],
        toolChoice: 'none',
        abortSignal: deps.abortSignal,
        ...(agent.maxOutputTokens != null
          ? { maxOutputTokens: agent.maxOutputTokens }
          : {}),
      });
      await consumeStream(recovery.stream);
      supplementalUsage.push(await recovery.usage);
      await deps.onEvent?.({
        type: 'response-recovery',
        state: 'completed',
      });
    }
    if (!text.trim()) {
      throw new Error('O provider encerrou sem produzir uma resposta.');
    }
    const usage = combineUsage(supplementalUsage);
    const run = buildRunRecord({
      agent: agent.name,
      tier: agent.tier,
      config: deps.config,
      usage,
      durationMs: Date.now() - started,
      status: 'ok',
      pricingTable: deps.pricingTable,
    });
    return { text, steps, run };
  } catch (error) {
    const run: RunRecord = {
      agent: agent.name,
      tier: agent.tier,
      provider: deps.config.provider,
      model: deps.config.model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - started,
      status: 'error',
      error: stringifyError(error),
    };
    throw new WorkflowError(run, error);
  }
}
