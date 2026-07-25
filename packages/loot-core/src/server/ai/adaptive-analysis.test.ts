import * as db from '#server/db';

import {
  adaptiveAnalysisQuerySchema,
  getFinancialDataCatalog,
  runFinancialAnalysis,
} from './adaptive-analysis';

beforeEach(global.emptyDatabase());

async function seedBaseData(): Promise<void> {
  await db.run(
    `INSERT INTO accounts
       (id, name, offbudget, closed, tombstone, sort_order, closing_day, due_day)
     VALUES
       ('checking', 'Conta corrente', 0, 0, 0, 1, NULL, NULL),
       ('card', 'Cartão', 0, 0, 0, 2, 10, 20)`,
  );
  await db.run(
    `INSERT INTO category_groups
       (id, name, is_income, sort_order, hidden, tombstone)
     VALUES
       ('expenses', 'Despesas', 0, 1, 0, 0),
       ('income', 'Receitas', 1, 2, 0, 0)`,
  );
  await db.run(
    `INSERT INTO categories
       (id, name, is_income, cat_group, sort_order, hidden, tombstone)
     VALUES
       ('groceries', 'Supermercado', 0, 'expenses', 1, 0, 0),
       ('salary', 'Salário', 1, 'income', 1, 0, 0)`,
  );
  await db.run(
    `INSERT INTO category_mapping (id, transferId)
     VALUES ('groceries', 'groceries'), ('salary', 'salary')`,
  );
  await db.run(
    `INSERT INTO payees
       (id, name, favorite, learn_categories, tombstone)
     VALUES
       ('market', 'Mercado', 0, 1, 0),
       ('employer', 'Empresa', 0, 1, 0)`,
  );
  await db.run(
    `INSERT INTO payee_mapping (id, targetId)
     VALUES ('market', 'market'), ('employer', 'employer')`,
  );
}

async function insertTransaction(params: {
  id: string;
  account?: string;
  category?: string;
  payee?: string;
  amount: number;
  date: number;
  transferredId?: string | null;
  pluggyBillId?: string | null;
}): Promise<void> {
  await db.run(
    `INSERT INTO transactions
       (id, isParent, isChild, acct, category, amount, description, date,
        starting_balance_flag, transferred_id, sort_order, tombstone, cleared,
        reconciled, pluggy_bill_id)
     VALUES (?, 0, 0, ?, ?, ?, ?, ?, 0, ?, 1, 0, 1, 0, ?)`,
    [
      params.id,
      params.account ?? 'checking',
      params.category ?? null,
      params.amount,
      params.payee ?? null,
      params.date,
      params.transferredId ?? null,
      params.pluggyBillId ?? null,
    ],
  );
}

describe('adaptive financial analysis', () => {
  it('publishes a semantic catalog without exposing physical tables', () => {
    const catalog = getFinancialDataCatalog('transactions');

    expect(catalog).toMatchObject({
      currency: 'BRL',
      monetaryUnit: 'cents',
      datasets: {
        transactions: {
          grain: expect.any(String),
          fields: {
            cash_flow_income: expect.objectContaining({ type: 'number' }),
            statement_id: expect.objectContaining({ type: 'string' }),
          },
        },
      },
      queryExamples: {
        monthlyCashFlowAndSavingsRate: {
          dataset: 'transactions',
          dimensions: ['year_month'],
        },
        expenseConcentrationByPayee: {
          dataset: 'transactions',
          dimensions: ['payee'],
        },
      },
    });
    expect(JSON.stringify(catalog)).not.toContain('category_mapping');
    expect(JSON.stringify(catalog)).not.toContain('SELECT ');
  });

  it('aggregates every matching transaction even when row inspection is truncated', async () => {
    await seedBaseData();
    for (let index = 0; index < 150; index++) {
      await insertTransaction({
        id: `expense-${index}`,
        category: 'groceries',
        payee: 'market',
        amount: -100,
        date: 20260701 + (index % 20),
      });
    }

    const aggregate = await runFinancialAnalysis({
      dataset: 'transactions',
      metrics: [
        { alias: 'transactions', operation: 'count' },
        {
          alias: 'total_spending',
          operation: 'sum',
          field: 'cash_flow_expense',
        },
      ],
      filters: [
        {
          field: 'date',
          operator: 'between',
          value: [20260701, 20260731],
        },
      ],
    });
    const inspection = await runFinancialAnalysis({
      dataset: 'transactions',
      fields: ['transaction_id', 'amount'],
      filters: [
        {
          field: 'date',
          operator: 'between',
          value: [20260701, 20260731],
        },
      ],
      limit: 100,
    });

    expect(aggregate.rows).toEqual([
      { transactions: 150, total_spending: 15000 },
    ]);
    expect(aggregate.coverage).toMatchObject({
      sourceRows: 150,
      resultRows: 1,
      complete: true,
      aggregationComplete: true,
    });
    expect(inspection.rows).toHaveLength(100);
    expect(inspection.coverage).toMatchObject({
      sourceRows: 150,
      resultRows: 150,
      returnedRows: 100,
      complete: false,
      outputTruncated: true,
    });
  });

  it('builds grouped metrics, conditional metrics, and deterministic calculations', async () => {
    await seedBaseData();
    await insertTransaction({
      id: 'salary-june',
      category: 'salary',
      payee: 'employer',
      amount: 500000,
      date: 20260605,
    });
    await insertTransaction({
      id: 'expense-june',
      category: 'groceries',
      payee: 'market',
      amount: -300000,
      date: 20260610,
    });
    await insertTransaction({
      id: 'salary-july',
      category: 'salary',
      payee: 'employer',
      amount: 600000,
      date: 20260705,
    });
    await insertTransaction({
      id: 'expense-july',
      category: 'groceries',
      payee: 'market',
      amount: -350000,
      date: 20260710,
    });
    await insertTransaction({
      id: 'ignored-transfer',
      amount: -900000,
      date: 20260711,
      transferredId: 'counterpart',
    });

    const result = await runFinancialAnalysis({
      dataset: 'transactions',
      dimensions: ['year_month'],
      metrics: [
        {
          alias: 'income',
          operation: 'sum',
          field: 'cash_flow_income',
        },
        {
          alias: 'expenses',
          operation: 'sum',
          field: 'cash_flow_expense',
        },
        {
          alias: 'expense_count',
          operation: 'count',
          filters: [
            { field: 'transaction_kind', operator: 'eq', value: 'expense' },
          ],
        },
      ],
      calculations: [
        {
          alias: 'savings',
          operation: 'subtract',
          left: 'income',
          right: 'expenses',
        },
        {
          alias: 'savings_rate',
          operation: 'divide',
          left: 'savings',
          right: 'income',
          decimals: 4,
        },
      ],
      orderBy: [{ field: 'year_month', direction: 'asc' }],
    });

    expect(result.rows).toEqual([
      {
        year_month: 202606,
        income: 500000,
        expenses: 300000,
        expense_count: 1,
        savings: 200000,
        savings_rate: 0.4,
      },
      {
        year_month: 202607,
        income: 600000,
        expenses: 350000,
        expense_count: 1,
        savings: 250000,
        savings_rate: 0.4167,
      },
    ]);
  });

  it('calculates each group share over the complete filtered result', async () => {
    await seedBaseData();
    await db.run(
      `INSERT INTO payees
         (id, name, favorite, learn_categories, tombstone)
       VALUES ('other-market', 'Outro mercado', 0, 1, 0)`,
    );
    await db.run(
      `INSERT INTO payee_mapping (id, targetId)
       VALUES ('other-market', 'other-market')`,
    );
    await insertTransaction({
      id: 'market-a',
      category: 'groceries',
      payee: 'market',
      amount: -30000,
      date: 20260710,
    });
    await insertTransaction({
      id: 'market-b',
      category: 'groceries',
      payee: 'other-market',
      amount: -70000,
      date: 20260711,
    });

    const result = await runFinancialAnalysis({
      dataset: 'transactions',
      dimensions: ['payee'],
      metrics: [
        { alias: 'spending', operation: 'sum', field: 'cash_flow_expense' },
        {
          alias: 'share',
          operation: 'share_of_total',
          field: 'cash_flow_expense',
          filters: [
            { field: 'transaction_kind', operator: 'eq', value: 'expense' },
          ],
        },
      ],
      orderBy: [{ field: 'spending', direction: 'desc' }],
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      payee: 'Outro mercado',
      spending: 70000,
    });
    expect(Number(result.rows[0].share)).toBeCloseTo(70);
    expect(Number(result.rows[1].share)).toBeCloseTo(30);
  });

  it('preserves authoritative statement provenance and membership', async () => {
    await seedBaseData();
    await db.run(
      `INSERT INTO statements
         (id, acct, start_date, end_date, due_date, budget_month,
          paid_transaction, tombstone, pluggy_bill_id, pluggy_total_amount)
       VALUES
         ('bank-statement', 'card', 20260611, 20260710, 20260720,
          202607, NULL, 0, 'bill-1', -42000),
         ('computed-statement', 'card', 20260711, 20260810, 20260820,
          202608, NULL, 0, NULL, NULL)`,
    );
    await insertTransaction({
      id: 'bank-purchase',
      account: 'card',
      category: 'groceries',
      payee: 'market',
      amount: -10000,
      date: 20260701,
      pluggyBillId: 'bill-1',
    });
    await insertTransaction({
      id: 'computed-purchase',
      account: 'card',
      category: 'groceries',
      payee: 'market',
      amount: -15000,
      date: 20260715,
    });

    const result = await runFinancialAnalysis({
      dataset: 'statements',
      fields: [
        'statement_id',
        'balance',
        'amount_due',
        'balance_source',
        'transaction_count',
      ],
      orderBy: [{ field: 'statement_id', direction: 'asc' }],
    });

    expect(result.rows).toEqual([
      {
        statement_id: 'bank-statement',
        balance: -42000,
        amount_due: 42000,
        balance_source: 'bank_reported',
        transaction_count: 1,
      },
      {
        statement_id: 'computed-statement',
        balance: -15000,
        amount_due: 15000,
        balance_source: 'computed_from_transactions',
        transaction_count: 1,
      },
    ]);
  });

  it('combines budget and activity through the published monthly semantics', async () => {
    await seedBaseData();
    await db.run(
      `INSERT INTO zero_budgets (id, month, category, amount, carryover)
       VALUES ('budget-july', 202607, 'groceries', 400000, 0)`,
    );
    await insertTransaction({
      id: 'groceries-july',
      category: 'groceries',
      payee: 'market',
      amount: -325000,
      date: 20260710,
    });

    const result = await runFinancialAnalysis({
      dataset: 'monthly_budget',
      dimensions: ['year_month', 'category'],
      metrics: [
        { alias: 'budgeted', operation: 'sum', field: 'budgeted' },
        { alias: 'spending', operation: 'sum', field: 'spending' },
      ],
      calculations: [
        {
          alias: 'remaining',
          operation: 'subtract',
          left: 'budgeted',
          right: 'spending',
        },
      ],
    });

    expect(result.rows).toContainEqual({
      year_month: 202607,
      category: 'Supermercado',
      budgeted: 400000,
      spending: 325000,
      remaining: 75000,
    });
  });

  it('fails closed for unknown datasets, fields, operands, and order targets', async () => {
    expect(() =>
      adaptiveAnalysisQuerySchema.parse({
        dataset: 'sqlite_master',
        fields: ['sql'],
      }),
    ).toThrow();
    await expect(
      runFinancialAnalysis({
        dataset: 'transactions',
        fields: ['tombstone'],
      }),
    ).rejects.toThrow('ANALYSIS_UNKNOWN_FIELD');
    await expect(
      runFinancialAnalysis({
        dataset: 'accounts',
        metrics: [
          { alias: 'total_balance', operation: 'sum', field: 'balance' },
        ],
        calculations: [
          {
            alias: 'unsafe',
            operation: 'divide',
            left: 'missing_alias',
            right: 2,
          },
        ],
      }),
    ).rejects.toThrow('ANALYSIS_UNKNOWN_OPERAND');
    await expect(
      runFinancialAnalysis({
        dataset: 'accounts',
        fields: ['account'],
        orderBy: [{ field: 'hidden_column', direction: 'asc' }],
      }),
    ).rejects.toThrow('ANALYSIS_UNKNOWN_ORDER_FIELD');
  });

  it('keeps filter values parameterized and rejects executable aliases', async () => {
    await seedBaseData();
    const maliciousValue = `'; DELETE FROM accounts; --`;

    const result = await runFinancialAnalysis({
      dataset: 'accounts',
      fields: ['account'],
      filters: [
        { field: 'account', operator: 'contains', value: maliciousValue },
      ],
    });

    expect(result.rows).toEqual([]);
    await expect(
      db.first<{ count: number }>(
        'SELECT COUNT(*) AS count FROM accounts WHERE tombstone = 0',
      ),
    ).resolves.toEqual({ count: 2 });
    expect(() =>
      adaptiveAnalysisQuerySchema.parse({
        dataset: 'accounts',
        metrics: [
          {
            alias: 'total); DELETE FROM accounts; --',
            operation: 'sum',
            field: 'balance',
          },
        ],
      }),
    ).toThrow();
  });
});
