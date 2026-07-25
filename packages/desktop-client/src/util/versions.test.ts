import { formatBuildVersion } from './versions';

describe('formatBuildVersion', () => {
  it('appends the short build revision when available', () => {
    expect(formatBuildVersion('1.0.0', 'e8010db384b9')).toBe('1.0.0 (e8010db)');
  });

  it('keeps the semantic version unchanged without a revision', () => {
    expect(formatBuildVersion('1.0.0')).toBe('1.0.0');
  });
});
