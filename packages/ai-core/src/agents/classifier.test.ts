import { describe, expect, it } from 'vitest';

import { buildClassifierPrompt, classifierOutputSchema } from './classifier';

describe('buildClassifierPrompt', () => {
  it('orders stable taxonomy before batch-specific evidence', () => {
    const blocks = buildClassifierPrompt({
      categories: [
        {
          id: 'c1',
          name: 'Groceries',
          group: 'Food',
          description: 'Food bought for preparation at home.',
        },
      ],
      history: [{ payeeName: 'Extra', categoryName: 'Groceries' }],
      rejections: [{ payeeName: 'Uber', categoryName: 'Transport' }],
      evidence: [
        {
          merchantClusterId: 'payee:extra',
          payeeName: 'Extra',
          categoryName: 'Groceries',
          outcome: 'accepted',
          similarity: 1,
        },
      ],
      research: [
        {
          merchantClusterId: 'payee:extra',
          query: 'Extra Brasil',
          summary: 'Extra is a supermarket.',
          sources: [
            {
              title: 'Extra',
              url: 'https://example.com',
              snippet: 'Brazilian supermarket.',
            },
          ],
        },
      ],
      transactions: [
        {
          id: 't1',
          payeeName: 'Extra',
          importedPayee: 'EXTRA LOJA 42',
          merchantClusterId: 'payee:extra',
          amountCents: -5000,
          date: '2026-01-05',
        },
      ],
    });

    expect(blocks.slice(0, 2).every(b => b.cacheable)).toBe(true);
    expect(blocks.slice(2).every(b => !b.cacheable)).toBe(true);
    expect(blocks.at(-1)?.cacheable).toBeUndefined();
    expect(blocks.at(-1)?.role).toBe('user');
    expect(blocks.at(-1)?.text).toContain('t1');
    expect(
      blocks.some(b => b.text.includes('Food bought for preparation at home.')),
    ).toBe(true);
    expect(blocks.some(b => b.text.includes('"Extra" -> Groceries'))).toBe(
      true,
    );
    expect(blocks.some(b => b.text.includes('"Uber" -/-> Transport'))).toBe(
      true,
    );
    expect(blocks.some(b => b.text.includes('outcome=accepted'))).toBe(true);
    expect(blocks.some(b => b.text.includes('untrusted_web_research'))).toBe(
      true,
    );
    expect(blocks.at(-1)?.text).toContain('EXTRA LOJA 42');
    expect(blocks.at(-1)?.text).toContain('payee:extra');
  });

  it('says explicitly when there is no correction history yet', () => {
    const blocks = buildClassifierPrompt({
      categories: [],
      history: [],
      rejections: [],
      transactions: [],
    });
    expect(blocks.some(b => b.text.includes('no prior corrections yet'))).toBe(
      true,
    );
    expect(
      blocks.some(b => b.text.includes('no rejected suggestions yet')),
    ).toBe(true);
  });
});

describe('classifierOutputSchema', () => {
  it('accepts a well-formed batch result', () => {
    const parsed = classifierOutputSchema.parse({
      items: [
        {
          id: 't1',
          categoryId: 'c1',
          confidence: 0.92,
          rationale: 'Known grocery payee',
        },
        {
          id: 't2',
          categoryId: null,
          confidence: 0.1,
          rationale: 'Unrecognized payee',
        },
      ],
    });
    expect(parsed.items).toHaveLength(2);
  });

  it('rejects an out-of-range confidence', () => {
    expect(() =>
      classifierOutputSchema.parse({
        items: [
          { id: 't1', categoryId: 'c1', confidence: 1.5, rationale: 'x' },
        ],
      }),
    ).toThrow();
  });
});
