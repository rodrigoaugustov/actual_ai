import { z } from 'zod';

import * as db from '#server/db';
import * as monthUtils from '#shared/months';

const ANALYSIS_MAX_OUTPUT_ROWS = 100;
const ANALYSIS_MAX_CALCULATION_ROWS = 1_000;

const aliasSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]{0,39}$/,
    'Use um identificador em snake_case com até 40 caracteres.',
  );

const scalarSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const analysisFilterSchema = z.object({
  field: z
    .string()
    .min(1)
    .max(80)
    .describe('Campo publicado no catálogo do dataset.'),
  operator: z
    .enum([
      'eq',
      'not_eq',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'in',
      'not_in',
      'contains',
      'starts_with',
      'is_null',
      'is_not_null',
    ])
    .describe('Operador determinístico aplicado ao campo.'),
  value: z
    .union([scalarSchema, z.array(scalarSchema).max(100)])
    .optional()
    .describe(
      'Valor; between exige dois, in/not_in exigem lista e filtros de null não recebem valor.',
    ),
});

export const analysisMetricSchema = z.object({
  alias: aliasSchema.describe('Nome da coluna resultante em snake_case.'),
  operation: z
    .enum([
      'count',
      'count_distinct',
      'sum',
      'average',
      'min',
      'max',
      'share_of_total',
    ])
    .describe('Agregação determinística.'),
  field: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe('Campo numérico; count pode omiti-lo.'),
  filters: z
    .array(analysisFilterSchema)
    .max(12)
    .default([])
    .describe('Filtros condicionais exclusivos desta métrica.'),
  filterMode: z
    .enum(['all', 'any'])
    .default('all')
    .describe('Combina filtros condicionais com AND ou OR.'),
});

const operandSchema = z.union([aliasSchema, z.number().finite()]);

export const analysisCalculationSchema = z.object({
  alias: aliasSchema.describe('Nome da coluna calculada em snake_case.'),
  operation: z
    .enum(['add', 'subtract', 'multiply', 'divide', 'percentage_change'])
    .describe('Operação aplicada após as métricas.'),
  left: operandSchema.describe('Alias anterior ou constante numérica.'),
  right: operandSchema.describe('Alias anterior ou constante numérica.'),
  decimals: z
    .number()
    .int()
    .min(0)
    .max(6)
    .default(2)
    .describe('Casas decimais do resultado.'),
});

export const adaptiveAnalysisQuerySchema = z
  .object({
    dataset: z
      .enum(['transactions', 'statements', 'accounts', 'monthly_budget'])
      .describe('Dataset semântico descrito por describe_financial_data.'),
    fields: z
      .array(z.string().min(1).max(80))
      .max(20)
      .default([])
      .describe('Campos para inspeção de linhas sem agregação.'),
    dimensions: z
      .array(z.string().min(1).max(80))
      .max(8)
      .default([])
      .describe('Campos de agrupamento para métricas.'),
    metrics: z
      .array(analysisMetricSchema)
      .max(16)
      .default([])
      .describe('Agregações que examinam todo o conjunto filtrado.'),
    calculations: z
      .array(analysisCalculationSchema)
      .max(12)
      .default([])
      .describe(
        'Cálculos determinísticos sobre campos e métricas resultantes.',
      ),
    filters: z
      .array(analysisFilterSchema)
      .max(20)
      .default([])
      .describe('Filtros globais da análise.'),
    filterMode: z
      .enum(['all', 'any'])
      .default('all')
      .describe('Combina filtros globais com AND ou OR.'),
    orderBy: z
      .array(
        z.object({
          field: z.string().min(1).max(80),
          direction: z.enum(['asc', 'desc']).default('asc'),
        }),
      )
      .max(8)
      .default([])
      .describe('Ordenação por campo ou alias retornado.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(ANALYSIS_MAX_OUTPUT_ROWS)
      .default(50)
      .describe('Quantidade de linhas devolvidas nesta página.'),
    offset: z
      .number()
      .int()
      .min(0)
      .max(100_000)
      .default(0)
      .describe('Offset para continuar uma inspeção quando necessário.'),
  })
  .refine(
    value =>
      value.fields.length > 0 ||
      value.dimensions.length > 0 ||
      value.metrics.length > 0,
    { message: 'Selecione ao menos um campo, dimensão ou métrica.' },
  )
  .refine(value => value.metrics.length === 0 || value.fields.length === 0, {
    message:
      'Consultas agregadas usam dimensions e metrics; fields é exclusivo para inspeção de linhas.',
  });

export type AdaptiveAnalysisQuery = z.infer<typeof adaptiveAnalysisQuerySchema>;
type AnalysisFilter = z.infer<typeof analysisFilterSchema>;
type AnalysisMetric = z.infer<typeof analysisMetricSchema>;
type AnalysisCalculation = z.infer<typeof analysisCalculationSchema>;

type AnalysisValue = string | number | null;
type AnalysisRow = Record<string, AnalysisValue>;
type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'year_month';

type SemanticField = {
  type: FieldType;
  description: string;
  aggregatable?: boolean;
};

type SemanticDataset = {
  description: string;
  grain: string;
  canonicalSemantics: string[];
  sourceSql: () => string;
  fields: Record<string, SemanticField>;
};

function currentDateNumber(): number {
  return Number(monthUtils.currentDay().replaceAll('-', ''));
}

const semanticDatasets: Record<
  AdaptiveAnalysisQuery['dataset'],
  SemanticDataset
> = {
  transactions: {
    description:
      'Lançamentos financeiros ativos. Use para análises adaptativas por período, conta, beneficiário, categoria, fatura e parcelamento.',
    grain: 'uma linha por transação não-pai e não excluída',
    canonicalSemantics: [
      'amount é assinado em centavos: entrada positiva e saída negativa',
      'outflow e inflow são magnitudes positivas, mas incluem transferências',
      'cash_flow_income e cash_flow_expense excluem transferências, saldo inicial e contas fora do orçamento',
      'statement_id respeita primeiro o vínculo de fatura Pluggy e depois o intervalo da fatura',
      'valores monetários usam BRL em centavos',
    ],
    sourceSql: () => `
      SELECT
        t.id AS transaction_id,
        t.date AS date,
        CAST(t.date / 10000 AS INTEGER) AS year,
        CAST(t.date / 100 AS INTEGER) AS year_month,
        t.amount AS amount,
        CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END AS inflow,
        CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END AS outflow,
        CASE
          WHEN t.amount > 0
           AND t.transferred_id IS NULL
           AND t.starting_balance_flag = 0
           AND a.offbudget = 0
          THEN t.amount ELSE 0
        END AS cash_flow_income,
        CASE
          WHEN t.amount < 0
           AND t.transferred_id IS NULL
           AND t.starting_balance_flag = 0
           AND a.offbudget = 0
          THEN -t.amount ELSE 0
        END AS cash_flow_expense,
        a.id AS account_id,
        a.name AS account,
        a.offbudget AS off_budget,
        CASE
          WHEN a.closing_day IS NOT NULL AND a.due_day IS NOT NULL
          THEN 1 ELSE 0
        END AS is_credit_card,
        p.name AS payee,
        c.id AS category_id,
        c.name AS category,
        g.name AS category_group,
        CASE WHEN t.transferred_id IS NULL THEN 0 ELSE 1 END AS is_transfer,
        t.starting_balance_flag AS is_starting_balance,
        t.cleared AS cleared,
        t.reconciled AS reconciled,
        t.notes AS notes,
        t.imported_description AS imported_description,
        t.installment_group AS installment_group,
        t.installment_num AS installment_number,
        t.installment_total AS installment_total,
        s.id AS statement_id,
        s.due_date AS statement_due_date,
        CASE
          WHEN t.transferred_id IS NOT NULL THEN 'transfer'
          WHEN t.starting_balance_flag = 1 THEN 'starting_balance'
          WHEN t.amount > 0 THEN 'income'
          WHEN t.amount < 0 THEN 'expense'
          ELSE 'zero'
        END AS transaction_kind
      FROM transactions t
      JOIN accounts a
        ON a.id = t.acct
       AND a.tombstone = 0
      LEFT JOIN payee_mapping pm ON pm.id = t.description
      LEFT JOIN payees p
        ON p.id = pm.targetId
       AND p.tombstone = 0
      LEFT JOIN category_mapping cm ON cm.id = t.category
      LEFT JOIN categories c
        ON c.id = cm.transferId
       AND c.tombstone = 0
      LEFT JOIN category_groups g
        ON g.id = c.cat_group
       AND g.tombstone = 0
      LEFT JOIN statements s
        ON s.acct = t.acct
       AND s.tombstone = 0
       AND (
         (t.pluggy_bill_id IS NOT NULL AND t.pluggy_bill_id = s.pluggy_bill_id)
         OR (
           t.pluggy_bill_id IS NULL
           AND t.date BETWEEN s.start_date AND s.end_date
         )
       )
      WHERE t.tombstone = 0
        AND t.isParent = 0`,
    fields: {
      transaction_id: {
        type: 'string',
        description: 'Identificador interno da transação.',
      },
      date: { type: 'date', description: 'Data YYYYMMDD.' },
      year: { type: 'number', description: 'Ano da transação.' },
      year_month: {
        type: 'year_month',
        description: 'Competência YYYYMM.',
      },
      amount: {
        type: 'number',
        description: 'Valor assinado em centavos.',
        aggregatable: true,
      },
      inflow: {
        type: 'number',
        description:
          'Magnitude positiva de entradas, inclusive transferências.',
        aggregatable: true,
      },
      outflow: {
        type: 'number',
        description: 'Magnitude positiva de saídas, inclusive transferências.',
        aggregatable: true,
      },
      cash_flow_income: {
        type: 'number',
        description:
          'Receita de fluxo de caixa, excluindo transferências, saldo inicial e off-budget.',
        aggregatable: true,
      },
      cash_flow_expense: {
        type: 'number',
        description:
          'Despesa de fluxo de caixa, excluindo transferências, saldo inicial e off-budget.',
        aggregatable: true,
      },
      account_id: { type: 'string', description: 'Identificador da conta.' },
      account: { type: 'string', description: 'Nome da conta.' },
      off_budget: {
        type: 'boolean',
        description: '1 para conta fora do orçamento.',
      },
      is_credit_card: {
        type: 'boolean',
        description: '1 para conta configurada como cartão.',
      },
      payee: { type: 'string', description: 'Beneficiário normalizado.' },
      category_id: {
        type: 'string',
        description: 'Identificador da categoria.',
      },
      category: { type: 'string', description: 'Nome da categoria.' },
      category_group: {
        type: 'string',
        description: 'Grupo da categoria.',
      },
      is_transfer: {
        type: 'boolean',
        description: '1 quando a transação é transferência.',
      },
      is_starting_balance: {
        type: 'boolean',
        description: '1 quando é saldo inicial.',
      },
      cleared: { type: 'boolean', description: '1 quando compensada.' },
      reconciled: { type: 'boolean', description: '1 quando reconciliada.' },
      notes: { type: 'string', description: 'Notas da transação.' },
      imported_description: {
        type: 'string',
        description: 'Descrição original importada.',
      },
      installment_group: {
        type: 'string',
        description: 'Identificador do parcelamento.',
      },
      installment_number: {
        type: 'number',
        description: 'Número da parcela.',
        aggregatable: true,
      },
      installment_total: {
        type: 'number',
        description: 'Quantidade total de parcelas.',
        aggregatable: true,
      },
      statement_id: {
        type: 'string',
        description: 'Fatura à qual o lançamento pertence.',
      },
      statement_due_date: {
        type: 'date',
        description: 'Vencimento da fatura YYYYMMDD.',
      },
      transaction_kind: {
        type: 'string',
        description: 'expense, income, transfer, starting_balance ou zero.',
      },
    },
  },
  statements: {
    description:
      'Faturas de cartão com saldo autoritativo do banco quando fornecido e fallback calculado pelos lançamentos.',
    grain: 'uma linha por fatura ativa',
    canonicalSemantics: [
      'balance usa o total informado pela Pluggy quando disponível',
      'balance_source informa bank_reported ou computed_from_transactions',
      'amount_due é a magnitude positiva de dívida',
      'pagamentos por transferência não reduzem o total de compras da própria fatura',
    ],
    sourceSql: () => `
      SELECT
        s.id AS statement_id,
        a.id AS account_id,
        a.name AS account,
        s.start_date AS start_date,
        s.end_date AS end_date,
        s.due_date AS due_date,
        CAST(s.end_date / 10000 AS INTEGER) AS year,
        CAST(s.end_date / 100 AS INTEGER) AS year_month,
        COALESCE(
          s.pluggy_total_amount,
          (
            SELECT SUM(t.amount)
            FROM transactions t
            WHERE t.acct = s.acct
              AND t.tombstone = 0
              AND t.isParent = 0
              AND t.transferred_id IS NULL
              AND (
                (
                  t.pluggy_bill_id IS NOT NULL
                  AND t.pluggy_bill_id = s.pluggy_bill_id
                )
                OR (
                  t.pluggy_bill_id IS NULL
                  AND t.date BETWEEN s.start_date AND s.end_date
                )
              )
          ),
          0
        ) AS balance,
        MAX(
          -COALESCE(
            s.pluggy_total_amount,
            (
              SELECT SUM(t.amount)
              FROM transactions t
              WHERE t.acct = s.acct
                AND t.tombstone = 0
                AND t.isParent = 0
                AND t.transferred_id IS NULL
                AND (
                  (
                    t.pluggy_bill_id IS NOT NULL
                    AND t.pluggy_bill_id = s.pluggy_bill_id
                  )
                  OR (
                    t.pluggy_bill_id IS NULL
                    AND t.date BETWEEN s.start_date AND s.end_date
                  )
                )
            ),
            0
          ),
          0
        ) AS amount_due,
        CASE
          WHEN s.pluggy_total_amount IS NOT NULL
          THEN 'bank_reported'
          ELSE 'computed_from_transactions'
        END AS balance_source,
        CASE
          WHEN s.paid_transaction IS NOT NULL
           AND (
             NOT EXISTS (
               SELECT 1 FROM transactions payment
               WHERE payment.id = s.paid_transaction
             )
             OR EXISTS (
               SELECT 1 FROM transactions payment
               WHERE payment.id = s.paid_transaction
                 AND payment.tombstone = 0
             )
           )
          THEN 'paid'
          WHEN ${currentDateNumber()} > s.end_date THEN 'closed'
          ELSE 'open'
        END AS status,
        (
          SELECT COUNT(*)
          FROM transactions t
          WHERE t.acct = s.acct
            AND t.tombstone = 0
            AND t.isParent = 0
            AND t.transferred_id IS NULL
            AND (
              (
                t.pluggy_bill_id IS NOT NULL
                AND t.pluggy_bill_id = s.pluggy_bill_id
              )
              OR (
                t.pluggy_bill_id IS NULL
                AND t.date BETWEEN s.start_date AND s.end_date
              )
            )
        ) AS transaction_count
      FROM statements s
      JOIN accounts a
        ON a.id = s.acct
       AND a.tombstone = 0
      WHERE s.tombstone = 0`,
    fields: {
      statement_id: { type: 'string', description: 'Identificador da fatura.' },
      account_id: { type: 'string', description: 'Identificador do cartão.' },
      account: { type: 'string', description: 'Nome do cartão.' },
      start_date: { type: 'date', description: 'Início YYYYMMDD.' },
      end_date: { type: 'date', description: 'Fechamento YYYYMMDD.' },
      due_date: { type: 'date', description: 'Vencimento YYYYMMDD.' },
      year: { type: 'number', description: 'Ano de fechamento.' },
      year_month: {
        type: 'year_month',
        description: 'Competência de fechamento YYYYMM.',
      },
      balance: {
        type: 'number',
        description: 'Saldo assinado da fatura em centavos.',
        aggregatable: true,
      },
      amount_due: {
        type: 'number',
        description: 'Dívida positiva da fatura em centavos.',
        aggregatable: true,
      },
      balance_source: {
        type: 'string',
        description: 'bank_reported ou computed_from_transactions.',
      },
      status: { type: 'string', description: 'open, closed ou paid.' },
      transaction_count: {
        type: 'number',
        description: 'Quantidade de lançamentos considerados.',
        aggregatable: true,
      },
    },
  },
  accounts: {
    description:
      'Contas ativas com saldo atual calculado sobre todos os lançamentos.',
    grain: 'uma linha por conta aberta',
    canonicalSemantics: [
      'balance é assinado em centavos',
      'off_budget separa contas patrimoniais das contas do orçamento',
      'is_credit_card deriva da configuração de fechamento e vencimento',
    ],
    sourceSql: () => `
      SELECT
        a.id AS account_id,
        a.name AS account,
        a.offbudget AS off_budget,
        CASE
          WHEN a.closing_day IS NOT NULL AND a.due_day IS NOT NULL
          THEN 1 ELSE 0
        END AS is_credit_card,
        COALESCE(SUM(
          CASE
            WHEN t.tombstone = 0 AND t.isParent = 0 THEN t.amount
            ELSE 0
          END
        ), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.acct = a.id
      WHERE a.tombstone = 0
        AND a.closed = 0
      GROUP BY a.id, a.name, a.offbudget, a.closing_day, a.due_day`,
    fields: {
      account_id: { type: 'string', description: 'Identificador da conta.' },
      account: { type: 'string', description: 'Nome da conta.' },
      off_budget: {
        type: 'boolean',
        description: '1 para conta fora do orçamento.',
      },
      is_credit_card: {
        type: 'boolean',
        description: '1 para conta configurada como cartão.',
      },
      balance: {
        type: 'number',
        description: 'Saldo atual assinado em centavos.',
        aggregatable: true,
      },
    },
  },
  monthly_budget: {
    description:
      'Orçamento e atividade por competência e categoria, compatível com envelope e tracking.',
    grain: 'uma linha por competência e categoria com orçamento ou atividade',
    canonicalSemantics: [
      'budgeted é o valor orçado em centavos',
      'activity é a soma assinada dos lançamentos sem transferências',
      'spending é a magnitude positiva das despesas',
      'income é a magnitude positiva das entradas',
    ],
    sourceSql: () => `
      WITH selected_budget AS (
        SELECT month, category, amount
        FROM zero_budgets
        WHERE COALESCE(
          (SELECT value FROM preferences WHERE id = 'budgetType'),
          'envelope'
        ) != 'tracking'
        UNION ALL
        SELECT month, category, amount
        FROM reflect_budgets
        WHERE (
          SELECT value FROM preferences WHERE id = 'budgetType'
        ) = 'tracking'
      ),
      activity AS (
        SELECT
          CAST(t.date / 100 AS INTEGER) AS month,
          cm.transferId AS category,
          SUM(CASE WHEN t.transferred_id IS NULL THEN t.amount ELSE 0 END)
            AS amount
        FROM transactions t
        LEFT JOIN category_mapping cm ON cm.id = t.category
        WHERE t.tombstone = 0
          AND t.isParent = 0
          AND t.starting_balance_flag = 0
        GROUP BY CAST(t.date / 100 AS INTEGER), cm.transferId
      ),
      budget_keys AS (
        SELECT month, category FROM selected_budget
        UNION
        SELECT month, category FROM activity WHERE category IS NOT NULL
      )
      SELECT
        keys.month AS year_month,
        CAST(keys.month / 100 AS INTEGER) AS year,
        c.id AS category_id,
        c.name AS category,
        g.name AS category_group,
        c.is_income AS is_income,
        COALESCE(b.amount, 0) AS budgeted,
        COALESCE(activity.amount, 0) AS activity,
        CASE
          WHEN COALESCE(activity.amount, 0) < 0
          THEN -activity.amount ELSE 0
        END AS spending,
        CASE
          WHEN COALESCE(activity.amount, 0) > 0
          THEN activity.amount ELSE 0
        END AS income
      FROM budget_keys keys
      JOIN categories c
        ON c.id = keys.category
       AND c.tombstone = 0
      JOIN category_groups g
        ON g.id = c.cat_group
       AND g.tombstone = 0
      LEFT JOIN selected_budget b
        ON b.month = keys.month
       AND b.category = keys.category
      LEFT JOIN activity
        ON activity.month = keys.month
       AND activity.category = keys.category`,
    fields: {
      year_month: {
        type: 'year_month',
        description: 'Competência YYYYMM.',
      },
      year: { type: 'number', description: 'Ano da competência.' },
      category_id: {
        type: 'string',
        description: 'Identificador da categoria.',
      },
      category: { type: 'string', description: 'Nome da categoria.' },
      category_group: {
        type: 'string',
        description: 'Grupo da categoria.',
      },
      is_income: {
        type: 'boolean',
        description: '1 para categoria de receita.',
      },
      budgeted: {
        type: 'number',
        description: 'Valor orçado em centavos.',
        aggregatable: true,
      },
      activity: {
        type: 'number',
        description: 'Atividade assinada em centavos.',
        aggregatable: true,
      },
      spending: {
        type: 'number',
        description: 'Magnitude positiva das despesas.',
        aggregatable: true,
      },
      income: {
        type: 'number',
        description: 'Magnitude positiva das entradas.',
        aggregatable: true,
      },
    },
  },
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function requireField(
  dataset: SemanticDataset,
  fieldName: string,
): SemanticField {
  const field = dataset.fields[fieldName];
  if (!field) {
    throw new Error(`ANALYSIS_UNKNOWN_FIELD: ${fieldName}`);
  }
  return field;
}

function normalizeScalar(value: unknown): AnalysisValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (value === null) return null;
  throw new Error('ANALYSIS_INVALID_FILTER_VALUE');
}

function compileFilters(
  dataset: SemanticDataset,
  filters: AnalysisFilter[],
  mode: 'all' | 'any',
): { sql: string; params: AnalysisValue[] } {
  if (filters.length === 0) {
    return { sql: '1 = 1', params: [] };
  }
  const fragments: string[] = [];
  const params: AnalysisValue[] = [];
  for (const filter of filters) {
    requireField(dataset, filter.field);
    const field = quoteIdentifier(filter.field);
    const values = Array.isArray(filter.value)
      ? filter.value.map(normalizeScalar)
      : filter.value === undefined
        ? []
        : [normalizeScalar(filter.value)];
    switch (filter.operator) {
      case 'eq':
      case 'not_eq':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        if (values.length !== 1) {
          throw new Error('ANALYSIS_FILTER_REQUIRES_ONE_VALUE');
        }
        const operator = {
          eq: '=',
          not_eq: '!=',
          gt: '>',
          gte: '>=',
          lt: '<',
          lte: '<=',
        }[filter.operator];
        fragments.push(`${field} ${operator} ?`);
        params.push(values[0]);
        break;
      }
      case 'between':
        if (values.length !== 2) {
          throw new Error('ANALYSIS_FILTER_REQUIRES_TWO_VALUES');
        }
        fragments.push(`${field} BETWEEN ? AND ?`);
        params.push(values[0], values[1]);
        break;
      case 'in':
      case 'not_in':
        if (values.length === 0) {
          throw new Error('ANALYSIS_FILTER_REQUIRES_VALUES');
        }
        fragments.push(
          `${field} ${filter.operator === 'in' ? 'IN' : 'NOT IN'} (${values
            .map(() => '?')
            .join(', ')})`,
        );
        params.push(...values);
        break;
      case 'contains':
      case 'starts_with': {
        if (values.length !== 1 || typeof values[0] !== 'string') {
          throw new Error('ANALYSIS_TEXT_FILTER_REQUIRES_STRING');
        }
        fragments.push(`LOWER(COALESCE(${field}, '')) LIKE ?`);
        params.push(
          filter.operator === 'contains'
            ? `%${values[0].toLowerCase()}%`
            : `${values[0].toLowerCase()}%`,
        );
        break;
      }
      case 'is_null':
      case 'is_not_null':
        if (values.length !== 0) {
          throw new Error('ANALYSIS_NULL_FILTER_TAKES_NO_VALUE');
        }
        fragments.push(
          `${field} IS ${filter.operator === 'is_not_null' ? 'NOT ' : ''}NULL`,
        );
        break;
      default:
        throw new Error('ANALYSIS_UNKNOWN_FILTER_OPERATOR');
    }
  }
  return {
    sql: fragments
      .map(fragment => `(${fragment})`)
      .join(mode === 'all' ? ' AND ' : ' OR '),
    params,
  };
}

function compileMetric(
  dataset: SemanticDataset,
  metric: AnalysisMetric,
): { sql: string; params: AnalysisValue[] } {
  const needsField = metric.operation !== 'count';
  if (needsField && !metric.field) {
    throw new Error(`ANALYSIS_METRIC_REQUIRES_FIELD: ${metric.alias}`);
  }
  const field = metric.field ? quoteIdentifier(metric.field) : null;
  if (metric.field) {
    const fieldSpec = requireField(dataset, metric.field);
    if (
      ['sum', 'average', 'min', 'max', 'share_of_total'].includes(
        metric.operation,
      ) &&
      (!fieldSpec.aggregatable || fieldSpec.type !== 'number')
    ) {
      throw new Error(`ANALYSIS_FIELD_NOT_NUMERIC: ${metric.field}`);
    }
  }
  const metricFilter = compileFilters(
    dataset,
    metric.filters,
    metric.filterMode,
  );
  const hasFilter = metric.filters.length > 0;
  let expression: string;
  let parameterRepeats = 1;
  switch (metric.operation) {
    case 'count':
      expression = hasFilter
        ? `SUM(CASE WHEN ${metricFilter.sql} THEN 1 ELSE 0 END)`
        : 'COUNT(*)';
      break;
    case 'count_distinct':
      expression = hasFilter
        ? `COUNT(DISTINCT CASE WHEN ${metricFilter.sql} THEN ${field} END)`
        : `COUNT(DISTINCT ${field})`;
      break;
    case 'sum':
      expression = hasFilter
        ? `COALESCE(SUM(CASE WHEN ${metricFilter.sql} THEN ${field} ELSE 0 END), 0)`
        : `COALESCE(SUM(${field}), 0)`;
      break;
    case 'average':
      expression = hasFilter
        ? `AVG(CASE WHEN ${metricFilter.sql} THEN ${field} END)`
        : `AVG(${field})`;
      break;
    case 'min':
      expression = hasFilter
        ? `MIN(CASE WHEN ${metricFilter.sql} THEN ${field} END)`
        : `MIN(${field})`;
      break;
    case 'max':
      expression = hasFilter
        ? `MAX(CASE WHEN ${metricFilter.sql} THEN ${field} END)`
        : `MAX(${field})`;
      break;
    case 'share_of_total': {
      const sumExpression = hasFilter
        ? `SUM(CASE WHEN ${metricFilter.sql} THEN ${field} ELSE 0 END)`
        : `SUM(${field})`;
      expression = `CASE
        WHEN SUM(${sumExpression}) OVER () = 0 THEN NULL
        ELSE (${sumExpression} * 100.0) / SUM(${sumExpression}) OVER ()
      END`;
      parameterRepeats = 3;
      break;
    }
    default:
      throw new Error('ANALYSIS_UNKNOWN_METRIC_OPERATION');
  }
  return {
    sql: `${expression} AS ${quoteIdentifier(metric.alias)}`,
    params: hasFilter
      ? Array.from(
          { length: parameterRepeats },
          () => metricFilter.params,
        ).flat()
      : [],
  };
}

function calculationOperand(
  row: AnalysisRow,
  operand: AnalysisCalculation['left'],
): number | null {
  if (typeof operand === 'number') return operand;
  const value = row[operand];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function applyCalculations(
  rows: AnalysisRow[],
  calculations: AnalysisCalculation[],
): AnalysisRow[] {
  return rows.map(originalRow => {
    const row = { ...originalRow };
    for (const calculation of calculations) {
      const left = calculationOperand(row, calculation.left);
      const right = calculationOperand(row, calculation.right);
      if (left == null || right == null) {
        row[calculation.alias] = null;
        continue;
      }
      let value: number | null;
      switch (calculation.operation) {
        case 'add':
          value = left + right;
          break;
        case 'subtract':
          value = left - right;
          break;
        case 'multiply':
          value = left * right;
          break;
        case 'divide':
          value = right === 0 ? null : left / right;
          break;
        case 'percentage_change':
          value = right === 0 ? null : ((left - right) / Math.abs(right)) * 100;
          break;
        default:
          throw new Error('ANALYSIS_UNKNOWN_CALCULATION_OPERATION');
      }
      row[calculation.alias] =
        value == null ? null : Number(value.toFixed(calculation.decimals));
    }
    return row;
  });
}

function compareValues(
  left: AnalysisValue | undefined,
  right: AnalysisValue | undefined,
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), 'pt-BR');
}

function sortRows(
  rows: AnalysisRow[],
  orderBy: AdaptiveAnalysisQuery['orderBy'],
): AnalysisRow[] {
  if (orderBy.length === 0) return rows;
  return [...rows].sort((left, right) => {
    for (const order of orderBy) {
      const comparison = compareValues(left[order.field], right[order.field]);
      if (comparison !== 0) {
        return order.direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
}

export function getFinancialDataCatalog(
  datasetName?: AdaptiveAnalysisQuery['dataset'],
) {
  const entries = datasetName
    ? [[datasetName, semanticDatasets[datasetName]] as const]
    : (Object.entries(semanticDatasets) as Array<
        [AdaptiveAnalysisQuery['dataset'], SemanticDataset]
      >);
  return {
    currency: 'BRL',
    monetaryUnit: 'cents',
    datasets: Object.fromEntries(
      entries.map(([name, dataset]) => [
        name,
        {
          description: dataset.description,
          grain: dataset.grain,
          canonicalSemantics: dataset.canonicalSemantics,
          fields: dataset.fields,
        },
      ]),
    ),
    queryCapabilities: {
      filters: [
        'eq',
        'not_eq',
        'gt',
        'gte',
        'lt',
        'lte',
        'between',
        'in',
        'not_in',
        'contains',
        'starts_with',
        'is_null',
        'is_not_null',
      ],
      metrics: [
        'count',
        'count_distinct',
        'sum',
        'average',
        'min',
        'max',
        'share_of_total',
      ],
      calculations: [
        'add',
        'subtract',
        'multiply',
        'divide',
        'percentage_change',
      ],
      filterModes: ['all', 'any'],
    },
    queryExamples: {
      monthlyCashFlowAndSavingsRate: {
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
        ],
        calculations: [
          {
            alias: 'savings',
            operation: 'subtract',
            left: 'income',
            right: 'expenses',
            decimals: 0,
          },
          {
            alias: 'savings_ratio',
            operation: 'divide',
            left: 'savings',
            right: 'income',
            decimals: 4,
          },
          {
            alias: 'savings_rate_percent',
            operation: 'multiply',
            left: 'savings_ratio',
            right: 100,
            decimals: 2,
          },
        ],
        orderBy: [{ field: 'year_month', direction: 'asc' }],
      },
      expenseConcentrationByPayee: {
        dataset: 'transactions',
        dimensions: ['payee'],
        metrics: [
          {
            alias: 'expenses',
            operation: 'sum',
            field: 'cash_flow_expense',
          },
          {
            alias: 'expense_share',
            operation: 'share_of_total',
            field: 'cash_flow_expense',
          },
        ],
        filters: [
          {
            field: 'cash_flow_expense',
            operator: 'gt',
            value: 0,
          },
        ],
        orderBy: [{ field: 'expenses', direction: 'desc' }],
      },
    },
  };
}

export async function runFinancialAnalysis(input: unknown) {
  const query = adaptiveAnalysisQuerySchema.parse(input);
  const dataset = semanticDatasets[query.dataset];
  const outputNames = new Set<string>();
  const selectedColumns: string[] = [];
  const metricParams: AnalysisValue[] = [];

  for (const field of [...query.fields, ...query.dimensions]) {
    requireField(dataset, field);
    if (outputNames.has(field)) {
      throw new Error(`ANALYSIS_DUPLICATE_OUTPUT: ${field}`);
    }
    outputNames.add(field);
    selectedColumns.push(quoteIdentifier(field));
  }
  for (const metric of query.metrics) {
    if (outputNames.has(metric.alias)) {
      throw new Error(`ANALYSIS_DUPLICATE_OUTPUT: ${metric.alias}`);
    }
    outputNames.add(metric.alias);
    const compiledMetric = compileMetric(dataset, metric);
    selectedColumns.push(compiledMetric.sql);
    metricParams.push(...compiledMetric.params);
  }
  for (const calculation of query.calculations) {
    if (outputNames.has(calculation.alias)) {
      throw new Error(`ANALYSIS_DUPLICATE_OUTPUT: ${calculation.alias}`);
    }
    for (const operand of [calculation.left, calculation.right]) {
      if (typeof operand === 'string' && !outputNames.has(operand)) {
        throw new Error(`ANALYSIS_UNKNOWN_OPERAND: ${operand}`);
      }
    }
    outputNames.add(calculation.alias);
  }
  for (const order of query.orderBy) {
    if (!outputNames.has(order.field)) {
      throw new Error(`ANALYSIS_UNKNOWN_ORDER_FIELD: ${order.field}`);
    }
  }

  const globalFilter = compileFilters(dataset, query.filters, query.filterMode);
  const groupBy =
    query.metrics.length > 0 && query.dimensions.length > 0
      ? ` GROUP BY ${query.dimensions.map(quoteIdentifier).join(', ')}`
      : '';
  const coreSql = `SELECT ${selectedColumns.join(', ')}
    FROM data
    WHERE ${globalFilter.sql}${groupBy}`;
  const coreParams = [...metricParams, ...globalFilter.params];
  const sourceSql = dataset.sourceSql();
  const sourceCount = await db.first<{ count: number }>(
    `WITH data AS (${sourceSql})
     SELECT COUNT(*) AS count FROM data WHERE ${globalFilter.sql}`,
    globalFilter.params,
  );
  const resultCount = await db.first<{ count: number }>(
    `WITH data AS (${sourceSql})
     SELECT COUNT(*) AS count FROM (${coreSql}) result`,
    coreParams,
  );
  const totalResultRows = resultCount?.count ?? 0;
  const hasCalculatedOrdering = query.orderBy.some(order =>
    query.calculations.some(calculation => calculation.alias === order.field),
  );
  if (
    hasCalculatedOrdering &&
    totalResultRows > ANALYSIS_MAX_CALCULATION_ROWS
  ) {
    throw new Error(
      'ANALYSIS_REFINEMENT_REQUIRED: refine filters or dimensions before ordering by a calculated value',
    );
  }

  const sqlOrderBy =
    !hasCalculatedOrdering && query.orderBy.length > 0
      ? ` ORDER BY ${query.orderBy
          .map(
            order =>
              `${quoteIdentifier(order.field)} ${order.direction.toUpperCase()}`,
          )
          .join(', ')}`
      : '';
  const fetchAllForCalculatedOrder = hasCalculatedOrdering;
  const rows = await db.all<AnalysisRow>(
    `WITH data AS (${sourceSql})
     ${coreSql}${sqlOrderBy}${
       fetchAllForCalculatedOrder ? '' : ' LIMIT ? OFFSET ?'
     }`,
    fetchAllForCalculatedOrder
      ? coreParams
      : [...coreParams, query.limit, query.offset],
  );
  const calculatedRows = applyCalculations(rows, query.calculations);
  const orderedRows = hasCalculatedOrdering
    ? sortRows(calculatedRows, query.orderBy).slice(
        query.offset,
        query.offset + query.limit,
      )
    : calculatedRows;
  const complete = query.offset === 0 && orderedRows.length >= totalResultRows;
  const hasMore = query.offset + orderedRows.length < totalResultRows;

  return {
    dataset: query.dataset,
    currency: 'BRL',
    monetaryUnit: 'cents',
    rows: orderedRows,
    coverage: {
      sourceRows: sourceCount?.count ?? 0,
      resultRows: totalResultRows,
      returnedRows: orderedRows.length,
      offset: query.offset,
      complete,
      hasMore,
      nextOffset: hasMore ? query.offset + orderedRows.length : null,
      aggregationComplete: true,
      outputTruncated: !complete,
    },
    evidence: {
      grain: dataset.grain,
      canonicalSemantics: dataset.canonicalSemantics,
      query,
      executedAt: Date.now(),
    },
  };
}
