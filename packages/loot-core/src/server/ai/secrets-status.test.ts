import * as asyncStorage from '#platform/server/asyncStorage';
import { get } from '#server/post';

import { getConfiguredSecrets } from './secrets-status';

vi.mock('#server/post', () => ({ get: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(asyncStorage.getItem).mockResolvedValue('test-token');
});

describe('getConfiguredSecrets', () => {
  it('reports a secret as configured when the check endpoint returns an empty body (204)', async () => {
    vi.mocked(get).mockResolvedValue('');

    const result = await getConfiguredSecrets('file-1');

    expect(result.ai_openai_key).toBe(true);
  });

  it('reports a secret as not configured when the check endpoint returns 404 text', async () => {
    vi.mocked(get).mockResolvedValue('key not found');

    const result = await getConfiguredSecrets('file-1');

    expect(result.ai_ollama_baseUrl).toBe(false);
  });

  it('checks every AI secret name and passes the fileId through to each request', async () => {
    vi.mocked(get).mockResolvedValue('');

    await getConfiguredSecrets('file-1');

    expect(get).toHaveBeenCalledTimes(5);
    for (const call of vi.mocked(get).mock.calls) {
      expect(call[1]).toMatchObject({
        headers: { 'X-Actual-File-Id': 'file-1' },
      });
    }
  });

  it('omits the file-id header when checking a global secret', async () => {
    vi.mocked(get).mockResolvedValue('');

    await getConfiguredSecrets(null);

    for (const call of vi.mocked(get).mock.calls) {
      expect(call[1]?.headers).not.toHaveProperty('X-Actual-File-Id');
    }
  });
});
