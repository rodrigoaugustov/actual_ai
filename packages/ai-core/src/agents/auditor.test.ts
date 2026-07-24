import { describe, expect, it } from 'vitest';

import {
  auditorAgent,
  auditorOutputSchema,
  buildAuditorPrompt,
} from './auditor';

describe('buildAuditorPrompt', () => {
  it('includes the rule rationale when the hit came from a mined rule', () => {
    const blocks = buildAuditorPrompt({
      payeeName: 'Extra',
      amountCents: -4590,
      appliedCategoryName: 'Groceries',
      ruleRationale: 'Consistent across 8 samples',
    });
    expect(blocks[1].text).toContain(
      'Rule rationale: Consistent across 8 samples',
    );
  });

  it('omits the rule rationale line when there is none', () => {
    const blocks = buildAuditorPrompt({
      payeeName: 'Extra',
      amountCents: -4590,
      appliedCategoryName: 'Groceries',
    });
    expect(blocks[1].text).not.toContain('Rule rationale');
  });

  it('is tier fast, since auditing is meant to be cheap', () => {
    expect(auditorAgent.tier).toBe('fast');
  });
});

describe('auditorOutputSchema', () => {
  it('accepts each valid verdict', () => {
    for (const verdict of ['correct', 'incorrect', 'uncertain'] as const) {
      expect(() =>
        auditorOutputSchema.parse({ verdict, rationale: 'x' }),
      ).not.toThrow();
    }
  });

  it('rejects an unknown verdict', () => {
    expect(() =>
      auditorOutputSchema.parse({ verdict: 'maybe', rationale: 'x' }),
    ).toThrow();
  });
});
