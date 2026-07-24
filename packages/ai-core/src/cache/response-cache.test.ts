import { describe, expect, it } from 'vitest';

import {
  bucketAmount,
  buildCacheKey,
  InMemoryResponseCache,
  normalizePayee,
} from './response-cache';

describe('normalizePayee', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizePayee('Pão de Açúcar - Loja 42')).toBe(
      'pao de acucar loja 42',
    );
  });

  it('is stable for equivalent payee spellings', () => {
    expect(normalizePayee('NETFLIX.COM')).toBe(normalizePayee('Netflix com'));
  });
});

describe('bucketAmount', () => {
  it('buckets by order of magnitude regardless of sign', () => {
    expect(bucketAmount(-500)).toBe('lt10');
    expect(bucketAmount(500)).toBe('lt10');
    expect(bucketAmount(5000)).toBe('lt100');
    expect(bucketAmount(50000)).toBe('lt1000');
    expect(bucketAmount(500000)).toBe('gte1000');
  });
});

describe('buildCacheKey', () => {
  it('produces the same key for near-identical recurring charges', () => {
    const a = buildCacheKey({
      account: 'acct1',
      payeeName: 'Netflix.com',
      amountCents: 3990,
    });
    const b = buildCacheKey({
      account: 'acct1',
      payeeName: 'NETFLIX.COM',
      amountCents: 4190,
    });
    expect(a).toBe(b);
  });

  it('differs across accounts', () => {
    const a = buildCacheKey({
      account: 'acct1',
      payeeName: 'X',
      amountCents: 100,
    });
    const b = buildCacheKey({
      account: 'acct2',
      payeeName: 'X',
      amountCents: 100,
    });
    expect(a).not.toBe(b);
  });
});

describe('InMemoryResponseCache', () => {
  it('round-trips a value', () => {
    const cache = new InMemoryResponseCache<{ category: string }>();
    expect(cache.get('k')).toBeUndefined();
    cache.set('k', {
      value: { category: 'Groceries' },
      cachedAt: '2026-01-01',
    });
    expect(cache.get('k')).toEqual({
      value: { category: 'Groceries' },
      cachedAt: '2026-01-01',
    });
  });
});
