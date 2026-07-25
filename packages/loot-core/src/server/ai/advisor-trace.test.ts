import {
  summarizeAdvisorCoverage,
  summarizeAdvisorToolInput,
  summarizeAdvisorToolResult,
} from './advisor-trace';

describe('advisor execution trace sanitization', () => {
  it('keeps analytical structure but removes filter values and unknown text', () => {
    const input = {
      dataset: 'transactions',
      dimensions: ['year_month', 'payee'],
      metrics: [
        {
          alias: 'expenses',
          operation: 'sum',
          field: 'cash_flow_expense',
        },
      ],
      filters: [
        {
          field: 'payee',
          operator: 'contains',
          value: 'Beneficiário confidencial',
        },
      ],
      query: 'segredo',
    };

    const summary = summarizeAdvisorToolInput('run_financial_analysis', input);

    expect(summary).toEqual({
      dataset: 'transactions',
      dimensions: ['year_month', 'payee'],
      metrics: ['expenses (sum)'],
      filters: ['payee (contains)'],
    });
    expect(JSON.stringify(summary)).not.toContain('confidencial');
    expect(JSON.stringify(summary)).not.toContain('segredo');
  });

  it('publishes only safe counts from results and coverage', () => {
    const output = {
      dataset: 'transactions',
      rows: [{ payee: 'Dado privado', expenses: 123_45 }],
      coverage: {
        sourceRows: 150,
        resultRows: 12,
        returnedRows: 12,
        complete: true,
        hasMore: false,
      },
      evidence: {
        query: 'internal',
      },
    };

    expect(summarizeAdvisorToolResult(output)).toEqual({
      dataset: 'transactions',
      count: 1,
    });
    expect(summarizeAdvisorCoverage(output)).toEqual({
      sourceRows: 150,
      resultRows: 12,
      returnedRows: 12,
      complete: true,
      hasMore: false,
    });
  });

  it('does not expose free-form search terms', () => {
    expect(
      summarizeAdvisorToolInput('search_transactions', {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        query: 'tratamento médico',
        accountId: 'private-account',
      }),
    ).toEqual({
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });
  });
});
