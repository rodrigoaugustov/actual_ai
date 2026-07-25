import { describe, expect, it, vi } from 'vitest';

import { buildModel } from './registry';

const fetchStub = vi.fn() as unknown as typeof fetch;

describe('buildModel', () => {
  it('builds an OpenAI Responses model pointed at the proxy baseURL', () => {
    const model = buildModel({
      provider: 'openai',
      model: 'gpt-5.6-luna',
      baseURL: 'https://proxy.example.com/ai/proxy/openai',
      fetch: fetchStub,
    });
    expect(model.modelId).toBe('gpt-5.6-luna');
    expect(model.provider).toBe('openai.responses');
  });

  it('builds an Anthropic model', () => {
    const model = buildModel({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      baseURL: 'https://proxy.example.com/ai/proxy/anthropic',
      fetch: fetchStub,
    });
    expect(model.modelId).toBe('claude-haiku-4-5');
    expect(model.provider).toContain('anthropic');
  });

  it('builds a Google model', () => {
    const model = buildModel({
      provider: 'google',
      model: 'gemini-2.5-flash',
      baseURL: 'https://proxy.example.com/ai/proxy/google',
      fetch: fetchStub,
    });
    expect(model.modelId).toBe('gemini-2.5-flash');
  });

  it('builds an OpenRouter model via the OpenAI-compatible adapter', () => {
    const model = buildModel({
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct',
      baseURL: 'https://proxy.example.com/ai/proxy/openrouter',
      fetch: fetchStub,
    });
    expect(model.modelId).toBe('meta-llama/llama-3.3-70b-instruct');
    expect(model.provider).toContain('openrouter');
  });

  it('builds an Ollama model via the OpenAI-compatible adapter', () => {
    const model = buildModel({
      provider: 'ollama',
      model: 'llama3.1',
      baseURL: 'https://proxy.example.com/ai/proxy/ollama',
      fetch: fetchStub,
    });
    expect(model.modelId).toBe('llama3.1');
    expect(model.provider).toContain('ollama');
  });

  it('throws for an unknown provider', () => {
    expect(() =>
      buildModel({
        // @ts-expect-error intentionally invalid for the test
        provider: 'bogus',
        model: 'x',
        baseURL: 'https://proxy.example.com',
        fetch: fetchStub,
      }),
    ).toThrow('Unknown AI provider');
  });
});
