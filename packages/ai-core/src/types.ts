import type { z } from 'zod';

export type Tier = 'fast' | 'standard' | 'frontier';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'ollama';

export type ProviderConfig = {
  provider: ProviderId;
  model: string;
  /** Base URL of our own sync-server proxy for this provider, e.g.
   * `https://sync.example.com/ai/proxy/anthropic`. The real provider host
   * and API key are resolved server-side; the client never holds either. */
  baseURL: string;
  /** Injects session auth headers before the request reaches the proxy. */
  fetch: typeof fetch;
};

export type TierConfig = Record<Tier, ProviderConfig>;

export type PromptBlock = {
  role: 'system' | 'user';
  text: string;
  /** Only Anthropic honors this today; other providers ignore it. Mark the
   * blocks that are stable across calls in the same run (instructions,
   * category tree, rule digest) so a cache breakpoint can sit right after
   * them, leaving only the truly variable block (the batch) uncached. */
  cacheable?: boolean;
};

// Constraining Output to an object shape (never `string`) lets TypeScript
// resolve generateObject's `Output extends string ? 'enum' : 'object'`
// overload discriminant for a still-generic Output inside runWorkflow,
// instead of deferring it to an unresolvable conditional type.
export type AgentDefinition<Input, Output extends Record<string, unknown>> = {
  name: string;
  tier: Tier;
  buildPrompt: (input: Input) => PromptBlock[];
  outputSchema: z.ZodType<Output>;
  maxOutputTokens?: number;
};

export type RunStatus = 'ok' | 'error';

export type RunRecord = {
  agent: string;
  tier: Tier;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  status: RunStatus;
  error?: string;
};

export type WorkflowResult<Output extends Record<string, unknown>> = {
  output: Output;
  run: RunRecord;
};
