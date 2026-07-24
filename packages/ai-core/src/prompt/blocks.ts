import type { PromptBlock } from '#types';

type ModelMessage = {
  role: 'system' | 'user';
  content: string;
  providerOptions?: {
    anthropic: { cacheControl: { type: 'ephemeral' } };
  };
};

/**
 * Turns ordered prompt blocks into AI SDK messages. Blocks must already be
 * ordered stable -> variable by the caller; this only attaches the
 * Anthropic cache breakpoint to blocks marked `cacheable` so a run's fixed
 * instructions/context are reused across calls in the same batch job
 * instead of being repriced every time.
 */
export function toModelMessages(blocks: PromptBlock[]): ModelMessage[] {
  return blocks.map(block => ({
    role: block.role,
    content: block.text,
    ...(block.cacheable
      ? {
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' as const } },
          },
        }
      : {}),
  }));
}
