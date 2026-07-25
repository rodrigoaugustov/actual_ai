import * as asyncStorage from '#platform/server/asyncStorage';
import { setServer } from '#server/server-config';

import { researchMerchant } from './merchant-enrichment';

beforeEach(global.emptyDatabase());

beforeEach(() => {
  setServer('https://sync.example.com');
  vi.mocked(asyncStorage.getItem).mockResolvedValue('test-token');
});

describe('merchant enrichment', () => {
  it('uses the authenticated proxy and caches projected research locally', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Duo Gourmet',
              url: 'https://duogourmet.com.br/',
              snippet: 'A Brazilian dining club.',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const first = await researchMerchant({
      merchantClusterId: 'payee:duogourmet',
      query: 'DuoGourmet empresa Brasil',
    });
    const second = await researchMerchant({
      merchantClusterId: 'payee:duogourmet',
      query: 'DuoGourmet empresa Brasil',
    });

    expect(first).toMatchObject({
      merchantClusterId: 'payee:duogourmet',
      summary: 'Duo Gourmet: A Brazilian dining club.',
    });
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://sync.example.com/ai/web-search');
    expect(new Headers(options?.headers).get('X-ACTUAL-TOKEN')).toBe(
      'test-token',
    );
  });

  it('fails closed on malformed proxy responses', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
      );

    expect(
      await researchMerchant({
        merchantClusterId: 'unknown',
        query: 'Unknown merchant',
      }),
    ).toBeNull();
  });
});
