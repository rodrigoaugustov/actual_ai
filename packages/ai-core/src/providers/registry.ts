import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV4 } from '@ai-sdk/provider';

import type { ProviderConfig } from '#types';

// The real API key lives server-side (sync-server's secrets service) and is
// injected by the proxy right before the request reaches the real provider
// host; the client only ever sends this placeholder. Every provider
// constructor below still requires a non-empty string to build its auth
// header, so this satisfies that without ever being a real credential.
const PLACEHOLDER_KEY = 'proxied-by-sync-server';

export function buildModel(config: ProviderConfig): LanguageModelV4 {
  const { provider, model, baseURL, fetch: proxiedFetch } = config;

  switch (provider) {
    case 'openai':
      // createOpenAI(...)(model) defaults to the Responses API
      // (/responses) in this SDK version — a behavioral default that
      // changed out from under earlier versions. We explicitly pick the
      // Chat Completions API (.chat) instead: it's the surface our proxy
      // path-versioning (/v1) and PROVIDER_HOSTS assume, and the one most
      // OpenAI-compatible accounts/keys support without extra opt-in.
      return createOpenAI({
        baseURL,
        apiKey: PLACEHOLDER_KEY,
        fetch: proxiedFetch,
      }).chat(model);
    case 'anthropic':
      return createAnthropic({
        baseURL,
        apiKey: PLACEHOLDER_KEY,
        fetch: proxiedFetch,
      })(model);
    case 'google':
      return createGoogleGenerativeAI({
        baseURL,
        apiKey: PLACEHOLDER_KEY,
        fetch: proxiedFetch,
      })(model);
    case 'openrouter':
      // Without this, the AI SDK falls back to a prompt-engineered JSON
      // extraction instead of requesting schema-constrained decoding —
      // noticeably less reliable for our generateObject-based agents.
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL,
        apiKey: PLACEHOLDER_KEY,
        fetch: proxiedFetch,
        supportsStructuredOutputs: true,
      })(model);
    case 'ollama':
      // Ollama's OpenAI-compatible endpoint ignores the Authorization header
      // entirely, but createOpenAICompatible still requires a value.
      // supportsStructuredOutputs unlocks Ollama's native JSON-schema
      // constrained decoding instead of the SDK's weaker prompt-based
      // fallback — the difference matters most on small local models.
      return createOpenAICompatible({
        name: 'ollama',
        baseURL,
        apiKey: PLACEHOLDER_KEY,
        fetch: proxiedFetch,
        supportsStructuredOutputs: true,
      })(model);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown AI provider: ${String(exhaustive)}`);
    }
  }
}
