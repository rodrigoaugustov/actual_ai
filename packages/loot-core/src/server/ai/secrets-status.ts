import { checkSecret } from '#server/accounts/app';

// Mirrors the SecretName keys registered in the sync-server's
// secrets-service.js for AI providers.
const SECRET_NAMES = [
  'ai_openai_key',
  'ai_anthropic_key',
  'ai_google_key',
  'ai_openrouter_key',
  'ai_ollama_baseUrl',
  'ai_brave_search_key',
] as const;

export type ConfiguredSecrets = Record<(typeof SECRET_NAMES)[number], boolean>;

/** The secrets endpoint only ever confirms existence (204) or absence
 * (404) — it never returns the stored value back to the client, same as
 * every other bank-sync credential in this app. This is what lets the API
 * key / Ollama host fields show "already configured" instead of looking
 * empty (and wrongly implying the save was lost) after a page reload. */
export async function getConfiguredSecrets(
  fileId?: string | null,
): Promise<ConfiguredSecrets> {
  const entries = await Promise.all(
    SECRET_NAMES.map(async name => {
      const result = await checkSecret({ name, fileId });
      const exists = typeof result === 'string' && result.length === 0;
      return [name, exists] as const;
    }),
  );
  return Object.fromEntries(entries) as ConfiguredSecrets;
}
