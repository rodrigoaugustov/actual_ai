import { describe, expect, it } from 'vitest';

import { getAccessibleTagForeground } from './tagContrast';

describe('getAccessibleTagForeground', () => {
  it.each([
    ['#ffffff', 'black'],
    ['#f2b84b', 'black'],
    ['#6d8fb3', 'black'],
    ['#26677a', 'white'],
    ['#10292f', 'white'],
    ['#000', 'white'],
  ])('uses the highest-contrast foreground for %s', (color, foreground) => {
    expect(getAccessibleTagForeground(color)).toBe(foreground);
  });

  it('falls back safely for an invalid color', () => {
    expect(getAccessibleTagForeground('not-a-color')).toBe('black');
  });
});
