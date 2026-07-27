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
      rejectedExamples: [],
      existingRuleDescriptions: [],
    });

    const userBlock = blocks.at(-1);
    expect(userBlock?.role).toBe('user');
    expect(userBlock?.text).toContain('Payee "Extra"');
    expect(userBlock?.text).toContain('c1=8');
    expect(userBlock?.text).toContain('EXTRA SUPERMERCADOS LTDA');
    // Only the static instructions + category list are cacheable — the
    // existing-rules/rejected-examples blocks change every run.
    expect(blocks.slice(0, 2).every(b => b.cacheable)).toBe(true);
    expect(blocks.slice(2, -1).some(b => b.cacheable)).toBe(false);
  });

  it('surfaces existing rules and rejected payee/category pairs so the model avoids repeating them', () => {
    const blocks = buildRuleMinerPrompt({
      categories: [{ id: 'c1', name: 'Groceries' }],
      candidates: [
        {
          payeeName: 'Uber',
          sampleDescriptions: ['UBER *TRIP'],
          categoryCounts: { c1: 5 },
        },
      ],
      rejectedExamples: [{ payeeName: 'Extra', categoryId: 'c1' }],
      existingRuleDescriptions: ['payee_name contains "ifood" => Groceries'],
    });

    const text = blocks.map(b => b.text).join('\n');
    expect(text).toContain('payee_name contains "ifood" => Groceries');
    expect(text).toContain('payee "Extra" -> category c1');
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
