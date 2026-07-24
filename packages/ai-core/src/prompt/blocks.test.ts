import { describe, expect, it } from 'vitest';

import type { PromptBlock } from '#types';

import { toModelMessages } from './blocks';

describe('toModelMessages', () => {
  it('passes through role and text unchanged', () => {
    const blocks: PromptBlock[] = [
      { role: 'system', text: 'Instructions' },
      { role: 'user', text: 'The batch' },
    ];
    const messages = toModelMessages(blocks);
    expect(messages).toEqual([
      { role: 'system', content: 'Instructions' },
      { role: 'user', content: 'The batch' },
    ]);
  });

  it('attaches an Anthropic cache breakpoint only to cacheable blocks', () => {
    const blocks: PromptBlock[] = [
      { role: 'system', text: 'Stable instructions', cacheable: true },
      { role: 'system', text: 'Category tree', cacheable: true },
      { role: 'user', text: 'This batch varies every call' },
    ];
    const messages = toModelMessages(blocks);

    expect(messages[0].providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
    expect(messages[1].providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
    expect(messages[2].providerOptions).toBeUndefined();
  });
});
