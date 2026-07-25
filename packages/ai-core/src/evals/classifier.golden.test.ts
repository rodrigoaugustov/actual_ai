import { describe, expect, it } from 'vitest';

import type { ClassifierOutput } from '#agents/classifier';

import { evaluateClassifierGoldenSet } from './classifier';
import type { ClassifierGoldenCase } from './classifier';

const goldenSet: ClassifierGoldenCase[] = [
  {
    id: 'accepted-grocery',
    expectedCategoryId: 'groceries',
    rejectedCategoryId: null,
  },
  {
    id: 'corrected-restaurant',
    expectedCategoryId: 'restaurants',
    rejectedCategoryId: 'groceries',
  },
  {
    id: 'rejected-transport',
    expectedCategoryId: null,
    rejectedCategoryId: 'transport',
  },
];

describe('classifier golden-set regression', () => {
  it('passes accepted, corrected, and rejected user decisions', () => {
    const output: ClassifierOutput = {
      items: [
        {
          id: 'accepted-grocery',
          categoryId: 'groceries',
          confidence: 0.95,
          rationale: 'Known market',
        },
        {
          id: 'corrected-restaurant',
          categoryId: 'restaurants',
          confidence: 0.9,
          rationale: 'User correction',
        },
        {
          id: 'rejected-transport',
          categoryId: null,
          confidence: 0.2,
          rationale: 'Insufficient evidence',
        },
      ],
    };

    expect(evaluateClassifierGoldenSet(goldenSet, output)).toMatchObject({
      total: 3,
      passed: 3,
      accuracy: 1,
      coverage: 1,
      failures: [],
    });
  });

  it('reports category regressions and missing predictions', () => {
    const output: ClassifierOutput = {
      items: [
        {
          id: 'accepted-grocery',
          categoryId: 'transport',
          confidence: 0.9,
          rationale: 'Regression',
        },
        {
          id: 'rejected-transport',
          categoryId: 'transport',
          confidence: 0.9,
          rationale: 'Repeated rejection',
        },
      ],
    };

    expect(evaluateClassifierGoldenSet(goldenSet, output)).toMatchObject({
      total: 3,
      passed: 0,
      accuracy: 0,
      coverage: 2 / 3,
    });
  });
});
