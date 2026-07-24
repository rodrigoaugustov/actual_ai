import { describe, expect, it } from 'vitest';

import { buildClassifierPrompt, classifierOutputSchema } from './classifier';

describe('buildClassifierPrompt', () => {
  it('orders blocks stable -> variable and marks the stable ones cacheable', () => {
    const blocks = buildClassifierPrompt({
      categories: [{ id: 'c1', name: 'Groceries', group: 'Food' }],
      history: [{ payeeName: 'Extra', categoryName: 'Groceries' }],
      transactions: [
        {
          id: 't1',
          payeeName: 'Extra',
          amountCents: -5000,
          date: '2026-01-05',
        },
      ],
    });

    expect(blocks.slice(0, -1).every(b => b.cacheable)).toBe(true);
    expect(blocks.at(-1)?.cacheable).toBeUndefined();
    expect(blocks.at(-1)?.role).toBe('user');
    expect(blocks.at(-1)?.text).toContain('t1');
    expect(blocks.some(b => b.text.includes('Groceries (c1)'))).toBe(true);
    expect(blocks.some(b => b.text.includes('"Extra" -> Groceries'))).toBe(
      true,
    );
  });

  it('says explicitly when there is no correction history yet', () => {
    const blocks = buildClassifierPrompt({
      categories: [],
      history: [],
      transactions: [],
    });
    expect(blocks.some(b => b.text.includes('no prior corrections yet'))).toBe(
      true,
    );
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
