import { describe, expect, it } from 'vitest';

import { buildRuleMinerPrompt, ruleMinerOutputSchema } from './rule-miner';

describe('buildRuleMinerPrompt', () => {
  it('includes category history and sample descriptions per candidate', () => {
    const blocks = buildRuleMinerPrompt({
      categories: [{ id: 'c1', name: 'Groceries' }],
      candidates: [
        {
          payeeName: 'Extra',
          sampleDescriptions: ['EXTRA SUPERMERCADOS LTDA', 'Extra 042'],
          categoryCounts: { c1: 8 },
        },
      ],
    });

    const userBlock = blocks.at(-1);
    expect(userBlock?.role).toBe('user');
    expect(userBlock?.text).toContain('Payee "Extra"');
    expect(userBlock?.text).toContain('c1=8');
    expect(userBlock?.text).toContain('EXTRA SUPERMERCADOS LTDA');
    expect(blocks.slice(0, -1).every(b => b.cacheable)).toBe(true);
  });
});

describe('ruleMinerOutputSchema', () => {
  it('accepts a well-formed proposal list', () => {
    const parsed = ruleMinerOutputSchema.parse({
      proposals: [
        {
          payeeName: 'Extra',
          op: 'contains',
          value: 'EXTRA',
          categoryId: 'c1',
          rationale: 'Consistent across 8 samples, no ambiguity',
          confidence: 0.95,
        },
      ],
    });
    expect(parsed.proposals).toHaveLength(1);
  });

  it('rejects an invalid op', () => {
    expect(() =>
      ruleMinerOutputSchema.parse({
        proposals: [
          {
            payeeName: 'Extra',
            op: 'regex',
            value: 'EXTRA',
            categoryId: 'c1',
            rationale: 'x',
            confidence: 0.9,
          },
        ],
      }),
    ).toThrow();
  });
});
