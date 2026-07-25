import { normalizePayee } from '@actual-app/ai';
import type { ClassifierResearchContext } from '@actual-app/ai';

import * as asyncStorage from '#platform/server/asyncStorage';
import * as db from '#server/db';
import { getPrefs } from '#server/prefs';
import { getServer } from '#server/server-config';
import type { AiWebSearchSource } from '#types/models/ai';

const ENRICHMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type EnrichmentRow = {
  id: string;
  normalizedQuery: string;
  locale: string;
  summary: string;
  sourcesJson: string;
  expiresAt: number;
};

function parseSources(value: string): AiWebSearchSource[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (
        !item ||
        typeof item !== 'object' ||
        !('title' in item) ||
        !('url' in item) ||
        !('snippet' in item) ||
        typeof item.title !== 'string' ||
        typeof item.url !== 'string' ||
        typeof item.snippet !== 'string'
      ) {
        return [];
      }
      return [
        {
          title: item.title,
          url: item.url,
          snippet: item.snippet,
        },
      ];
    });
  } catch {
    return [];
  }
}

function summarizeSources(sources: AiWebSearchSource[]): string {
  return sources
    .map(source => `${source.title}: ${source.snippet}`)
    .join('\n')
    .slice(0, 5000);
}

async function buildEnrichmentId(
  normalizedQuery: string,
  locale: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${locale}:${normalizedQuery}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `merchant-enrichment:${hash}`;
}

async function fetchWebSearch(
  query: string,
  locale: string,
): Promise<AiWebSearchSource[]> {
  const server = getServer();
  if (!server) {
    throw new Error('No sync server configured; web search requires one.');
  }
  const userToken = await asyncStorage.getItem('user-token');
  const fileId = getPrefs()?.cloudFileId;
  const headers = new Headers({ 'content-type': 'application/json' });
  if (userToken) headers.set('X-ACTUAL-TOKEN', userToken);
  if (fileId) headers.set('X-Actual-File-Id', fileId);
  const response = await fetch(`${server.AI_SERVER}/web-search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, locale, count: 3 }),
  });
  if (!response.ok) {
    throw new Error(
      `Merchant web search failed with status ${response.status}.`,
    );
  }
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('results' in payload) ||
    !Array.isArray(payload.results)
  ) {
    return [];
  }
  return payload.results.flatMap(item => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('title' in item) ||
      !('url' in item) ||
      !('snippet' in item) ||
      typeof item.title !== 'string' ||
      typeof item.url !== 'string' ||
      typeof item.snippet !== 'string'
    ) {
      return [];
    }
    return [
      {
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      },
    ];
  });
}

export async function researchMerchant({
  merchantClusterId,
  query,
}: {
  merchantClusterId: string;
  query: string;
}): Promise<ClassifierResearchContext | null> {
  const normalizedQuery = normalizePayee(query).slice(0, 200);
  if (normalizedQuery.length < 3) return null;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'pt-BR';
  const cached = await db.first<EnrichmentRow>(
    `SELECT id,
            normalized_query AS normalizedQuery,
            locale,
            summary,
            sources_json AS sourcesJson,
            expires_at AS expiresAt
       FROM ai_merchant_enrichments
      WHERE normalized_query = ?
        AND locale = ?
        AND tombstone = 0
      LIMIT 1`,
    [normalizedQuery, locale],
  );
  if (cached && cached.expiresAt > Date.now()) {
    return {
      merchantClusterId,
      query,
      summary: cached.summary,
      sources: parseSources(cached.sourcesJson),
    };
  }

  const sources = await fetchWebSearch(query, locale);
  if (sources.length === 0) return null;
  const summary = summarizeSources(sources);
  const now = Date.now();
  if (cached) {
    await db.update('ai_merchant_enrichments', {
      id: cached.id,
      summary,
      sources_json: JSON.stringify(sources),
      expires_at: now + ENRICHMENT_TTL_MS,
      updated_at: now,
      tombstone: 0,
    });
  } else {
    await db.insertWithUUID('ai_merchant_enrichments', {
      id: await buildEnrichmentId(normalizedQuery, locale),
      normalized_query: normalizedQuery,
      locale,
      summary,
      sources_json: JSON.stringify(sources),
      expires_at: now + ENRICHMENT_TTL_MS,
      created_at: now,
      updated_at: now,
      tombstone: 0,
    });
  }
  return {
    merchantClusterId,
    query,
    summary,
    sources,
  };
}
