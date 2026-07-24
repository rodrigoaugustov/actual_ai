import type { ProviderConfig } from '@actual-app/ai';

import * as asyncStorage from '#platform/server/asyncStorage';
import { getPrefs } from '#server/prefs';
import { getServer } from '#server/server-config';
import type { AiProviderId, AiTier } from '#types/models/ai';

import { getAiConfig } from './config';

// The AI SDK builds request URLs as `${baseURL}${path}` (e.g. path =
// '/chat/completions') and never adds an API version prefix itself — that's
// only true of each provider's own *default* baseURL, which we never use
// since we always point baseURL at our proxy. Each provider's real API
// requires its own version segment, so it has to be baked in here; the
// proxy's own prefix-stripping (see app-ai.js) forwards this to the real
// host unchanged, since it only strips '/proxy/<provider>'.
const PROVIDER_VERSION_PATH: Record<AiProviderId, string> = {
  openai: '/v1',
  anthropic: '/v1',
  google: '/v1beta',
  openrouter: '/v1',
  ollama: '/v1',
};

/** Builds the ai-core ProviderConfig for a tier: baseURL points at the
 * sync-server's proxy for that provider, and the injected fetch adds the
 * same session-auth headers loot-core already sends to every other
 * sync-server endpoint (see accounts/sync.ts's `post()` calls). The proxy
 * — not this client — resolves the real provider host and API key. */
export async function buildProviderConfigForTier(
  tier: AiTier,
): Promise<ProviderConfig> {
  const config = getAiConfig();
  const tierConfig = config.tiers[tier];

  const server = getServer();
  if (!server) {
    throw new Error('No sync server configured; AI features require one.');
  }

  const userToken = await asyncStorage.getItem('user-token');
  const fileId = getPrefs()?.cloudFileId;
  const baseURL = `${server.AI_SERVER}/proxy/${tierConfig.provider}${PROVIDER_VERSION_PATH[tierConfig.provider]}`;

  const authedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (userToken) headers.set('X-ACTUAL-TOKEN', userToken);
    if (fileId) headers.set('X-Actual-File-Id', fileId);
    return fetch(input, { ...init, headers });
  };

  return {
    provider: tierConfig.provider,
    model: tierConfig.model,
    baseURL,
    fetch: authedFetch,
  };
}
