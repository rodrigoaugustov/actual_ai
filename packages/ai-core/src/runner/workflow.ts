import { generateObject } from 'ai';

import { buildRunRecord } from '#cost/ledger';
import type { PricingTable } from '#cost/pricing';
import { toModelMessages } from '#prompt/blocks';
import { buildModel } from '#providers/registry';
import type {
  AgentDefinition,
  ProviderConfig,
  RunRecord,
  WorkflowResult,
} from '#types';

const ZERO_USAGE = {
  inputTokens: 0,
  inputTokenDetails: {
    noCacheTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokens: 0,
  outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
  totalTokens: 0,
} as const;

export class WorkflowError extends Error {
  run: RunRecord;
  cause: unknown;

  constructor(run: RunRecord, cause: unknown) {
    super(run.error ?? 'AI workflow run failed');
    this.name = 'WorkflowError';
    this.run = run;
    this.cause = cause;
  }
}

export type WorkflowDeps = {
  config: ProviderConfig;
  pricingTable?: PricingTable;
};

/** Runs a single-shot, structured-output workflow step: no tool-use loop,
 * no multi-step control by the model — the calling code owns the pipeline
 * (classification, rule mining, auditing). The tool-use advisor has a
 * separate runner planned for a later phase. */
export async function runWorkflow<
  Input,
  Output extends Record<string, unknown>,
>(
  agent: AgentDefinition<Input, Output>,
  input: Input,
  deps: WorkflowDeps,
): Promise<WorkflowResult<Output>> {
  const model = buildModel(deps.config);
  const messages = toModelMessages(agent.buildPrompt(input));
  const started = Date.now();

  try {
    // generateObject's overload set discriminates 'object' vs 'enum' mode
    // via `Output extends string ? ... : ...`, which TypeScript can't
    // resolve for a still-generic Output inside this generic function (it
    // resolves fine at every concrete call site — see workflow.test.ts and
    // each agent's own test). Casting the call argument is the standard
    // escape hatch for a generic wrapper around an overloaded generic
    // library call; agents never use enum-mode schemas, so the 'object'
    // branch is always the right one at runtime, and the result is cast
    // back to `Output` below.
    const result = await generateObject({
      model,
      schema: agent.outputSchema,
      messages,
      // Our prompt blocks are entirely code-constructed (never persisted
      // third-party conversation content), so multiple `system`-role
      // messages here are safe — that's exactly what the AI SDK's
      // warning on this flag cautions against.
      allowSystemInMessages: true,
      ...(agent.maxOutputTokens != null
        ? { maxOutputTokens: agent.maxOutputTokens }
        : {}),
    } as Parameters<typeof generateObject>[0]);

    const run = buildRunRecord({
      agent: agent.name,
      tier: agent.tier,
      config: deps.config,
      usage: result.usage,
      durationMs: Date.now() - started,
      status: 'ok',
      pricingTable: deps.pricingTable,
    });

    return { output: result.object as Output, run };
  } catch (error) {
    const run = buildRunRecord({
      agent: agent.name,
      tier: agent.tier,
      config: deps.config,
      usage: ZERO_USAGE,
      durationMs: Date.now() - started,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      pricingTable: deps.pricingTable,
    });
    throw new WorkflowError(run, error);
  }
}
