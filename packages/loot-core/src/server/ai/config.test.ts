import { DEFAULT_AI_CONFIG, getAiConfig, setAiConfig } from './config';

beforeEach(global.emptyDatabase());

describe('getAiConfig / setAiConfig', () => {
  it('returns the default config when nothing has been saved', () => {
    expect(getAiConfig()).toEqual(DEFAULT_AI_CONFIG);
  });

  it('round-trips a saved config', async () => {
    const config = {
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.9,
      tiers: {
        ...DEFAULT_AI_CONFIG.tiers,
        standard: { provider: 'openai' as const, model: 'gpt-5-mini' },
      },
    };

    await setAiConfig(config);

    expect(getAiConfig()).toEqual(config);
  });

  it('falls back to defaults for tiers missing from a partial saved config', async () => {
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      tiers: { standard: { provider: 'openai', model: 'gpt-5-mini' } } as never,
    });

    const config = getAiConfig();
    expect(config.tiers.standard).toEqual({
      provider: 'openai',
      model: 'gpt-5-mini',
    });
    expect(config.tiers.fast).toEqual(DEFAULT_AI_CONFIG.tiers.fast);
    expect(config.tiers.frontier).toEqual(DEFAULT_AI_CONFIG.tiers.frontier);
  });
});
