import { ADVISOR_MAX_STEPS, advisorAgent } from './advisor';

describe('advisorAgent', () => {
  it('is a bounded frontier agent with consultative safeguards', () => {
    expect(advisorAgent).toMatchObject({
      name: 'advisor',
      tier: 'frontier',
      maxSteps: ADVISOR_MAX_STEPS,
      requiredToolFollowUps: [
        {
          after: 'describe_financial_data',
          require: 'run_financial_analysis',
        },
      ],
    });
    expect(advisorAgent.instructions).toContain('nunca invente');
    expect(advisorAgent.instructions).toContain('read-only');
    expect(advisorAgent.instructions).toContain('propose_memory');
    expect(advisorAgent.instructions).toContain('nunca termine no meio');
    expect(advisorAgent.instructions).toContain('run_financial_analysis');
    expect(advisorAgent.instructions).toContain('coverage');
    expect(advisorAgent.instructions).toContain('nunca os exponha');
    expect(advisorAgent.instructions).toContain('bank_reported');
    expect(advisorAgent.instructions).toContain('queryExamples');
    expect(advisorAgent.instructions).toContain('nunca use placeholders');
    expect(advisorAgent.instructions).toContain('tente novamente');
    expect(advisorAgent.instructions).toContain('ausência de registros');
    expect(advisorAgent.instructions).toContain('não mencione logs');
    expect(ADVISOR_MAX_STEPS).toBeGreaterThanOrEqual(12);
    expect(advisorAgent.maxOutputTokens).toBeGreaterThanOrEqual(3200);
  });
});
