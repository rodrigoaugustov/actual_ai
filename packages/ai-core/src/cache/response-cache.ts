export type ResponseCacheEntry<T> = {
  value: T;
  cachedAt: string;
};

/** Injectable so loot-core can back it with a SQLite table; ai-core stays
 * storage-agnostic. */
export type ResponseCacheStore<T> = {
  get(
    key: string,
  ):
    | ResponseCacheEntry<T>
    | undefined
    | Promise<ResponseCacheEntry<T> | undefined>;
  set(key: string, entry: ResponseCacheEntry<T>): void | Promise<void>;
};

export class InMemoryResponseCache<T> implements ResponseCacheStore<T> {
  private store = new Map<string, ResponseCacheEntry<T>>();

  get(key: string) {
    return this.store.get(key);
  }

  set(key: string, entry: ResponseCacheEntry<T>) {
    this.store.set(key, entry);
  }
}

export function normalizePayee(payeeName: string): string {
  return payeeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Buckets by order of magnitude so a subscription/bill that fluctuates a
 * few cents still hits the same cache entry, without over-matching
 * unrelated amounts. */
export function bucketAmount(amountCents: number): string {
  const abs = Math.abs(amountCents);
  if (abs < 1000) return 'lt10';
  if (abs < 10000) return 'lt100';
  if (abs < 100000) return 'lt1000';
  return 'gte1000';
}

export function buildCacheKey(input: {
  account: string;
  payeeName: string;
  amountCents: number;
}): string {
  return [
    input.account,
    normalizePayee(input.payeeName),
    bucketAmount(input.amountCents),
  ].join('::');
}
