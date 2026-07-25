import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SecretName, secretsService } from '#services/secrets-service';

import { handlers as app } from './app-ai';

function mockUpstream(status, headers, bodyText) {
  global.fetch = vi
    .fn()
    .mockResolvedValue(new Response(bodyText, { status, headers }));
}

const call = (path, body = {}) =>
  request(app).post(path).set('x-actual-token', 'valid-token').send(body);

describe('app-ai proxy', () => {
  beforeEach(() => {
    secretsService.set(SecretName.ai_openai_key, null);
    secretsService.set(SecretName.ai_anthropic_key, null);
    secretsService.set(SecretName.ai_google_key, null);
    secretsService.set(SecretName.ai_openrouter_key, null);
    secretsService.set(SecretName.ai_ollama_baseUrl, null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an unknown provider', async () => {
    const res = await call('/proxy/bogus/v1/whatever');
    expect(res.status).toBe(404);
    expect(res.body.reason).toBe('unknown-provider');
  });

  it('returns not-configured when no key is stored for a real provider', async () => {
    const res = await call('/proxy/anthropic/v1/messages');
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('not-configured');
  });

  it('forwards to the Anthropic host, path and body, injecting x-api-key', async () => {
    secretsService.set(SecretName.ai_anthropic_key, 'sk-ant-real-key');
    mockUpstream(
      200,
      { 'content-type': 'application/json' },
      JSON.stringify({ id: 'msg_1' }),
    );

    const res = await call('/proxy/anthropic/v1/messages', {
      model: 'claude-haiku-4-5',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'msg_1' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('sk-ant-real-key');
    expect(options.headers.authorization).toBeUndefined();
    expect(JSON.parse(options.body.toString())).toEqual({
      model: 'claude-haiku-4-5',
    });
  });

  it('forwards to Google with x-goog-api-key', async () => {
    secretsService.set(SecretName.ai_google_key, 'goog-real-key');
    mockUpstream(200, { 'content-type': 'application/json' }, '{}');

    await call('/proxy/google/v1beta/models/gemini-2.5-flash:generateContent');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(options.headers['x-goog-api-key']).toBe('goog-real-key');
  });

  it('forwards to OpenAI with a Bearer Authorization header', async () => {
    secretsService.set(SecretName.ai_openai_key, 'sk-openai-real-key');
    mockUpstream(200, { 'content-type': 'application/json' }, '{}');

    await call('/proxy/openai/v1/chat/completions');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.headers.authorization).toBe('Bearer sk-openai-real-key');
  });

  it('forwards OpenAI Responses API requests through the same authenticated proxy', async () => {
    secretsService.set(SecretName.ai_openai_key, 'sk-openai-real-key');
    mockUpstream(
      200,
      { 'content-type': 'application/json' },
      JSON.stringify({ id: 'resp_1', status: 'completed' }),
    );

    const res = await call('/proxy/openai/v1/responses', {
      model: 'gpt-5.6-luna',
      tools: [{ type: 'function', name: 'snapshot' }],
    });

    expect(res.status).toBe(200);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.authorization).toBe('Bearer sk-openai-real-key');
    expect(JSON.parse(options.body.toString())).toMatchObject({
      model: 'gpt-5.6-luna',
      tools: [{ type: 'function', name: 'snapshot' }],
    });
  });

  it('routes ollama to the configured host without injecting an auth header', async () => {
    secretsService.set(
      SecretName.ai_ollama_baseUrl,
      'http://192.168.1.50:11434',
    );
    mockUpstream(200, { 'content-type': 'application/json' }, '{}');

    await call('/proxy/ollama/v1/chat/completions');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('http://192.168.1.50:11434/v1/chat/completions');
  });

  it('reports not-configured when ollama has no host set', async () => {
    const res = await call('/proxy/ollama/v1/chat/completions');
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('not-configured');
  });

  it('strips content-encoding/length from the relayed response', async () => {
    secretsService.set(SecretName.ai_openai_key, 'k');
    mockUpstream(
      200,
      { 'content-type': 'application/json', 'content-encoding': 'gzip' },
      '{"ok":true}',
    );

    const res = await call('/proxy/openai/v1/chat/completions');

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body).toEqual({ ok: true });
  });

  it('relays the upstream error body when the provider rejects the request', async () => {
    secretsService.set(SecretName.ai_openai_key, 'k');
    mockUpstream(
      400,
      { 'content-type': 'application/json' },
      JSON.stringify({ error: { message: 'invalid schema' } }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    const res = await call('/proxy/openai/v1/chat/completions');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'invalid schema' } });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('invalid schema'),
    );
  });

  it('returns 502 when the upstream host is unreachable', async () => {
    secretsService.set(SecretName.ai_openai_key, 'k');
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await call('/proxy/openai/v1/chat/completions');

    expect(res.status).toBe(502);
    expect(res.body.reason).toBe('upstream-unreachable');
  });
});
