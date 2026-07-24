import * as asyncStorage from '#platform/server/asyncStorage';
import { setServer } from '#server/server-config';

import { DEFAULT_AI_CONFIG, setAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';

beforeEach(global.emptyDatabase());

beforeEach(() => {
  setServer('https://sync.example.com');
  vi.mocked(asyncStorage.getItem).mockResolvedValue('test-token');
});

describe('buildProviderConfigForTier', () => {
  it.each([
    ['openai', '/v1'],
    ['anthropic', '/v1'],
    ['google', '/v1beta'],
    ['openrouter', '/v1'],
    ['ollama', '/v1'],
  ] as const)(
    // The AI SDK builds request URLs as `${baseURL}${path}` and never adds
    // an API version prefix for a custom baseURL (verified against the
    // installed @ai-sdk/* packages) — each provider's real API needs its
    // own version segment baked into our baseURL, or every call 404s
    // upstream.
    'bakes the %s API version segment (%s) into the proxy baseURL',
    async (provider, versionPath) => {
      await setAiConfig({
        ...DEFAULT_AI_CONFIG,
        tiers: {
          ...DEFAULT_AI_CONFIG.tiers,
          standard: { provider, model: 'test-model' },
        },
      });

      const config = await buildProviderConfigForTier('standard');

      expect(config.baseURL).toBe(
        `https://sync.example.com/ai/proxy/${provider}${versionPath}`,
      );
    },
  );
});
