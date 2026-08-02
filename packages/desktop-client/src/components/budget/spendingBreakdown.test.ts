import { describe, expect, it } from 'vitest';

import { getSpendingBreakdown } from './util';

describe('getSpendingBreakdown', () => {
  it.each([
    [-13000, 10000, -23000],
    [5000, 10000, -5000],
    [-5000, -1000, -4000],
    [0, 0, 0],
  ])('preserves spending + transfers = net', (net, transfers, spending) => {
    expect(getSpendingBreakdown(net, transfers)).toEqual({
      spending,
      transfers,
      net,
    });
  });
});
