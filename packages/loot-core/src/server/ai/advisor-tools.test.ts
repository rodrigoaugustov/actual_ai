import * as db from '#server/db';

import { listMemoryFacts } from './advisor-memory';
import { advisorToolSpecs, createAdvisorToolHandlers } from './advisor-tools';

beforeEach(global.emptyDatabase());

async function seedFinancialData(): Promise<void> {
  await db.run(
    `INSERT INTO accounts
       (id, name, offbudget, closed, tombstone, sort_order)
     VALUES
       ('checking', 'Conta corrente', 0, 0, 0, 1),
       ('investments', 'Investimentos', 1, 0, 0, 2)`,
  );
  await db.run(
    `INSERT INTO category_groups
       (id, name, is_income, sort_order, hidden, tombstone)
     VALUES ('living', 'Moradia', 0, 1, 0, 0)`,
  );
  await db.run(
    `INSERT INTO categories
       (id, name, is_income, cat_group, sort_order, hidden, tombstone)
     VALUES ('rent', 'Aluguel', 0, 'living', 1, 0, 0)`,
  );
  await db.run(
    `INSERT INTO category_mapping (id, transferId)
     VALUES ('rent', 'rent')`,
  );
  await db.run(
    `INSERT INTO payees
       (id, name, favorite, learn_categories, tombstone)
     VALUES ('employer', 'Empresa', 0, 1, 0),
            ('landlord', 'Imobiliária', 0, 1, 0)`,
  );
  await db.run(
    `INSERT INTO payee_mapping (id, targetId)
     VALUES ('employer', 'employer'), ('landlord', 'landlord')`,
  );
  await db.run(
    `INSERT INTO transactions
       (id, isParent, isChild, acct, category, amount, description, date,
        starting_balance_flag, sort_order, tombstone, cleared, reconciled)
     VALUES
       ('salary', 0, 0, 'checking', NULL, 1000000, 'employer', 20260705,
        0, 1, 0, 1, 0),
       ('rent-payment', 0, 0, 'checking', 'rent', -250000, 'landlord', 20260710,
        0, 2, 0, 1, 0),
       ('investment-balance', 0, 0, 'investments', NULL, 500000, NULL, 20260701,
        1, 1, 0, 1, 0)`,
  );
  await db.run(
    `INSERT INTO zero_budgets (id, month, category, amount, carryover)
     VALUES ('2026-07-rent', 202607, 'rent', 260000, 0)`,
  );
}

describe('advisor financial tools', () => {
  it('offers adaptive analysis without leaking row limits in descriptions', () => {
    expect(advisorToolSpecs.map(tool => tool.name)).toEqual(
      expect.arrayContaining([
        'describe_financial_data',
        'run_financial_analysis',
      ]),
    );
    const transactionSearch = advisorToolSpecs.find(
      tool => tool.name === 'search_transactions',
    );
    expect(transactionSearch?.description).not.toMatch(
      /máximo|limite|100 itens/i,
    );
    expect(transactionSearch?.description).toContain('run_financial_analysis');
  });

  it('returns deterministic cents and excludes off-budget accounts from cash flow', async () => {
    await seedFinancialData();
    const handlers = createAdvisorToolHandlers({
      conversationId: 'conversation',
      includeSensitiveMemory: false,
      sourceMessageId: 'message',
    });

    await expect(handlers.get_financial_snapshot({})).resolves.toMatchObject({
      currency: 'BRL',
      netWorth: 1250000,
      onBudgetBalance: 750000,
    });
    await expect(
      handlers.get_cash_flow({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      }),
    ).resolves.toEqual({
      currency: 'BRL',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      income: 1000000,
      expenses: 250000,
      net: 750000,
    });
  });

  it('aggregates categories, searches transactions and reads the budget month', async () => {
    await seedFinancialData();
    const handlers = createAdvisorToolHandlers({
      conversationId: 'conversation',
      includeSensitiveMemory: false,
      sourceMessageId: 'message',
    });

    await expect(
      handlers.get_spending_by_category({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      }),
    ).resolves.toMatchObject({
      categories: [
        expect.objectContaining({
          category: 'Aluguel',
          amount: 250000,
          transactionCount: 1,
        }),
      ],
      coverage: {
        totalCount: 1,
        returnedCount: 1,
        complete: true,
        hasMore: false,
      },
    });
    await expect(
      handlers.search_transactions({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        query: 'imobiliária',
      }),
    ).resolves.toMatchObject({
      rows: [
        expect.objectContaining({
          id: 'rent-payment',
          payee: 'Imobiliária',
          category: 'Aluguel',
        }),
      ],
      coverage: {
        totalCount: 1,
        returnedCount: 1,
        complete: true,
      },
    });
    await expect(
      handlers.get_budget_month({ month: '2026-07' }),
    ).resolves.toMatchObject({
      month: '2026-07',
      budgetType: 'envelope',
      categories: [
        expect.objectContaining({
          category: 'Aluguel',
          budgeted: 260000,
          spent: -250000,
        }),
      ],
    });
  });

  it('reports whether each credit-card balance came from the institution', async () => {
    await db.run(
      `INSERT INTO accounts
         (id, name, offbudget, closed, tombstone, sort_order, closing_day, due_day)
       VALUES ('card', 'Cartão', 0, 0, 0, 1, 10, 20)`,
    );
    await db.run(
      `INSERT INTO statements
         (id, acct, start_date, end_date, due_date, budget_month,
          paid_transaction, tombstone, pluggy_bill_id, pluggy_total_amount)
       VALUES
         ('official', 'card', 20260611, 20260710, 20260720, 202607,
          NULL, 0, 'bill-1', -440000),
         ('computed', 'card', 20260711, 20260810, 20260820, 202608,
          NULL, 0, NULL, NULL)`,
    );
    const handlers = createAdvisorToolHandlers({
      conversationId: 'conversation',
      includeSensitiveMemory: false,
      sourceMessageId: 'message',
    });

    await expect(
      handlers.get_credit_card_statements({ limit: 12 }),
    ).resolves.toMatchObject({
      statements: expect.arrayContaining([
        expect.objectContaining({
          id: 'official',
          balance: -440000,
          balanceSource: 'bank_reported',
        }),
        expect.objectContaining({
          id: 'computed',
          balanceSource: 'computed_from_transactions',
        }),
      ]),
      coverage: {
        totalCount: 2,
        returnedCount: 2,
        complete: true,
        hasMore: false,
      },
    });
  });

  it('returns retry guidance for a safe but semantically invalid analysis', async () => {
    const handlers = createAdvisorToolHandlers({
      conversationId: 'conversation',
      includeSensitiveMemory: false,
      sourceMessageId: 'message',
    });

    await expect(
      handlers.run_financial_analysis({
        dataset: 'transactions',
        metrics: [
          {
            alias: 'unknown_total',
            operation: 'sum',
            field: 'field_that_is_not_in_the_catalog',
          },
        ],
      }),
    ).resolves.toEqual({
      status: 'invalid_query',
      retryable: true,
      error: 'ANALYSIS_UNKNOWN_FIELD: field_that_is_not_in_the_catalog',
      guidance: expect.stringContaining('queryExamples'),
    });
  });

  it('only creates a candidate when the agent proposes a memory', async () => {
    const handlers = createAdvisorToolHandlers({
      conversationId: 'conversation',
      includeSensitiveMemory: false,
      sourceMessageId: 'source-message',
    });

    const result = await handlers.propose_memory({
      kind: 'life_stage',
      value: 'Esperando o primeiro filho',
      originalText: 'Estamos esperando nosso primeiro filho.',
    });

    expect(result).toMatchObject({
      status: 'candidate',
      requiresConfirmation: true,
    });
    expect(await listMemoryFacts('confirmed')).toEqual([]);
    expect(await listMemoryFacts('candidate')).toMatchObject([
      {
        kind: 'life_stage',
        sourceMessageId: 'source-message',
      },
    ]);
  });
});
