import { Readable } from 'node:stream';

import express from 'express';

import { isAdmin } from '#account-db';
import { SecretName, secretsService } from '#services/secrets-service';
import * as UserService from '#services/user-service';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';
import { isValidFileId } from '#util/paths';

const app = express();
export { app as handlers };

app.use(requestLoggerMiddleware);
// The AI SDK sends whatever content-type the target provider expects
// (almost always application/json); we forward the exact bytes upstream
// rather than re-parsing and re-serializing JSON, so a raw buffer is what
// we want here regardless of content-type.
app.use(express.raw({ type: () => true, limit: '20mb' }));
app.use(validateSessionMiddleware);

function canAccessFile(fileId, userId) {
  return isAdmin(userId) || UserService.countUserAccess(fileId, userId) > 0;
}

// Real provider hosts. Ollama has no fixed host — it's whatever the user
// configured (see ai_ollama_baseUrl below) — so it isn't listed here.
const PROVIDER_HOSTS = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  openrouter: 'https://openrouter.ai/api',
};

const PROVIDER_KEY_SECRETS = {
  openai: SecretName.ai_openai_key,
  anthropic: SecretName.ai_anthropic_key,
  google: SecretName.ai_google_key,
  openrouter: SecretName.ai_openrouter_key,
};

// Each provider expects its key in a different header; the AI SDK client
// sends a placeholder Authorization header (see @actual-app/ai's registry),
// which we always overwrite here with the real key in the shape the
// provider actually expects.
function applyAuthHeader(provider, headers, apiKey) {
  delete headers.authorization;
  switch (provider) {
    case 'anthropic':
      headers['x-api-key'] = apiKey;
      break;
    case 'google':
      headers['x-goog-api-key'] = apiKey;
      break;
    default:
      headers.authorization = `Bearer ${apiKey}`;
  }
}

// Headers that identify the client->sync-server hop, or that would
// otherwise be wrong once forwarded (host, framing, our own session auth).
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'x-actual-token',
  'x-actual-file-id',
  'cookie',
]);

// The response left this proxy already decoded by Node's fetch (undici);
// forwarding the original encoding/length headers would describe bytes we
// no longer have. Framing headers are re-derived by Express itself.
const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

app.all('/proxy/:provider/{*splat}', async (req, res) => {
  const { provider } = req.params;
  const fileId = req.get('X-Actual-File-Id');

  if (fileId) {
    if (!isValidFileId(fileId)) {
      res.status(400).send({
        status: 'error',
        reason: 'invalid-file-id',
        details: 'invalid fileId',
      });
      return;
    }

    if (!canAccessFile(fileId, res.locals.user_id)) {
      res.status(403).send({
        status: 'error',
        reason: 'file-access-denied',
        details: "You don't have permissions over this file",
      });
      return;
    }
  }

  const credentialFileId = fileId ?? null;
  const prefix = `/proxy/${provider}`;
  const restOfPath = req.path.slice(prefix.length);
  const query = req.url.slice(req.path.length);

  let targetBase;
  let apiKey = null;

  if (provider === 'ollama') {
    targetBase = secretsService.get(
      SecretName.ai_ollama_baseUrl,
      credentialFileId,
    );
    if (!targetBase) {
      res.status(400).send({
        status: 'error',
        reason: 'not-configured',
        details: 'Ollama host is not configured',
      });
      return;
    }
  } else if (Object.hasOwn(PROVIDER_HOSTS, provider)) {
    targetBase = PROVIDER_HOSTS[provider];
    apiKey = secretsService.get(
      PROVIDER_KEY_SECRETS[provider],
      credentialFileId,
    );
    if (!apiKey) {
      res.status(400).send({
        status: 'error',
        reason: 'not-configured',
        details: `${provider} API key is not configured`,
      });
      return;
    }
  } else {
    res.status(404).send({ status: 'error', reason: 'unknown-provider' });
    return;
  }

  const targetUrl = targetBase + restOfPath + query;

  const forwardedHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardedHeaders[key] = value;
    }
  }
  if (apiKey) applyAuthHeader(provider, forwardedHeaders, apiKey);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardedHeaders,
      body: ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : (req.body ?? undefined),
    });

    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((value, key) => {
      if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (upstreamRes.status >= 400) {
      // The AI SDK's own request/schema shape can trigger a provider-side
      // rejection (bad model id, unsupported response_format, quota, etc.)
      // that's otherwise invisible: requestLoggerMiddleware only logs the
      // status code, and the client-side AI SDK error swallows the body.
      const text = await upstreamRes.text();
      console.error(
        `AI proxy upstream error: ${provider} ${req.method} ${restOfPath} -> ${upstreamRes.status}\n${text.slice(0, 2000)}`,
      );
      res.send(text);
    } else if (upstreamRes.body) {
      // Streaming-safe: works for a single JSON reply today and for SSE
      // (streamText, the future advisor chat) without changing this path.
      Readable.fromWeb(upstreamRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    res.status(502).send({
      status: 'error',
      reason: 'upstream-unreachable',
      details: error.message,
    });
  }
});
