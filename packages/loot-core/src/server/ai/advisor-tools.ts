import type { ToolHandlerMap, ToolSpec } from '@actual-app/ai';
import { z } from 'zod';

import { getStatements } from '#server/credit-cards/app';
import * as db from '#server/db';

import {
  adaptiveAnalysisQuerySchema,
  getFinancialDataCatalog,
  runFinancialAnalysis,
} from './adaptive-analysis';
import {
  createAdviceRecord,
  createMemoryCandidate,
  listAdviceRecords,
  listGoals,
  listMemoryFacts,
  searchAdvisorContext,
} from './advisor-memory';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato YYYY-MM-DD.');
const dateRangeSchema = z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine(value => value.startDate <= value.endDate, {
    message: 'A data inicial deve ser anterior à data final.',
  });
const limitedDateRangeSchema = dateRangeSchema.refine(
  value => dateToNumber(value.endDate) - dateToNumber(value.startDate) <= 50000,
  { message: 'O intervalo máximo é de cinco anos.' },
);

function dateToNumber(date: string): number {
  return Number(date.replaceAll('-', ''));
}

export const advisorToolSpecs: ToolSpec[] = [
  {
    name: 'describe_financial_data',
    description:
      'Descreve os datasets, campos e semânticas canônicas disponíveis para construir análises financeiras adaptativas.',
    inputSchema: z.object({
      dataset: z
        .enum(['transactions', 'statements', 'accounts', 'monthly_budget'])
        .optional(),
    }),
    access: 'read',
  },
  {
    name: 'run_financial_analysis',
    description:
      'Executa uma análise determinística criada por você sobre datasets financeiros seguros. Suporta filtros, dimensões, métricas condicionais, cálculos e ordenação. Comece pelos queryExamples de describe_financial_data e adapte-os. Agregações sempre examinam todo o conjunto filtrado; use coverage internamente para refinar resultados incompletos.',
    inputSchema: adaptiveAnalysisQuerySchema,
    access: 'read',
  },
  {
    name: 'get_financial_snapshot',
    description:
      'Obtém saldos por conta e patrimônio líquido com valores exatos em centavos.',
    inputSchema: z.object({}),
    access: 'read',
  },
  {
    name: 'get_cash_flow',
    description:
      'Calcula entradas, saídas e fluxo líquido em um intervalo, sem contar transferências.',
    inputSchema: limitedDateRangeSchema,
    access: 'read',
  },
  {
    name: 'get_spending_by_category',
    description:
      'Atalho para despesas agregadas por categoria. Para combinações, tendências e comparações, prefira run_financial_analysis.',
    inputSchema: limitedDateRangeSchema.extend({
      limit: z.number().int().min(1).max(50).default(15),
    }),
    access: 'read',
  },
  {
    name: 'search_transactions',
    description:
      'Inspeciona lançamentos específicos por período e texto, conta ou categoria. Não derive totais desta ferramenta; para cálculos completos use run_financial_analysis.',
    inputSchema: limitedDateRangeSchema.extend({
      query: z.string().trim().max(120).optional(),
      accountId: z.string().optional(),
      categoryId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(30),
    }),
    access: 'read',
  },
  {
    name: 'get_budget_month',
    description:
      'Obtém valores orçados e realizados por categoria para um mês YYYY-MM.',
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
    }),
    access: 'read',
  },
  {
    name: 'get_credit_card_statements',
    description:
      'Obtém faturas dos cartões, incluindo vencimento, situação e saldo em centavos.',
    inputSchema: z.object({
      accountId: z.string().optional(),
      limit: z.number().int().min(1).max(36).default(12),
    }),
    access: 'read',
  },
  {
    name: 'search_advisor_context',
    description:
      'Recupera memórias confirmadas, objetivos, documentos e resumos relevantes.',
    inputSchema: z.object({
      query: z.string().trim().min(2).max(300),
      limit: z.number().int().min(1).max(20).default(8),
    }),
    access: 'read',
  },
  {
    name: 'get_advisor_profile',
    description:
      'Obtém o perfil confirmado, objetivos e recomendações acompanhadas do usuário.',
    inputSchema: z.object({}),
    access: 'read',
  },
  {
    name: 'propose_memory',
    description:
      'Propõe uma memória extraída da conversa. Ela só será usada após confirmação explícita do usuário.',
    inputSchema: z.object({
      kind: z.string().trim().min(2).max(80),
      value: z.unknown(),
      originalText: z.string().trim().max(500),
      sensitivity: z.enum(['normal', 'sensitive']).default('normal'),
      confidence: z.number().min(0).max(1).default(1),
    }),
    access: 'write',
  },
  {
    name: 'propose_advice',
    description:
      'Registra uma recomendação material como proposta, com premissas, alternativas e riscos, para o usuário aceitar ou rejeitar.',
    inputSchema: z.object({
      title: z.string().trim().min(3).max(120),
      recommendation: z.string().trim().min(10).max(2_000),
      assumptions: z
        .array(z.string().trim().min(2).max(300))
        .max(10)
        .default([]),
      alternatives: z
        .array(z.string().trim().min(2).max(500))
        .max(8)
        .default([]),
      risks: z.array(z.string().trim().min(2).max(500)).max(8).default([]),
      followUpAt: z.number().int().positive().nullable().default(null),
    }),
    access: 'write',
  },
];

type AdvisorToolContext = {
  conversationId: string;
  includeSensitiveMemory: boolean;
  sourceMessageId: string;
};

export function createAdvisorToolHandlers(
  context: AdvisorToolContext,
): ToolHandlerMap {
  return {
    describe_financial_data: async input => {
      const value = z
        .object({
          dataset: z
            .enum(['transactions', 'statements', 'accounts', 'monthly_budget'])
            .optional(),
        })
        .parse(input);
      return getFinancialDataCatalog(value.dataset);
    },
    run_financial_analysis: async input => {
      try {
        return await runFinancialAnalysis(input);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('ANALYSIS_')) {
          return {
            status: 'invalid_query',
            retryable: true,
            error: error.message,
            guidance:
              'Revise campos, aliases e operandos usando describe_financial_data e seus queryExamples, então tente run_financial_analysis novamente.',
          };
        }
        throw error;
      }
    },
    get_financial_snapshot: async () => {
      const accounts = await db.all<{
        id: string;
        name: string;
        offbudget: 0 | 1;
        balance: number;
      }>(
        `SELECT a.id, a.name, a.offbudget, COALESCE(SUM(t.amount), 0) AS balance
           FROM accounts a
           LEFT JOIN transactions t
             ON t.acct = a.id
            AND t.tombstone = 0
            AND t.isParent = 0
          WHERE a.tombstone = 0 AND a.closed = 0
          GROUP BY a.id, a.name, a.offbudget
          ORDER BY a.offbudget, a.name`,
      );
      return {
        currency: 'BRL',
        netWorth: accounts.reduce(
          (total, account) => total + account.balance,
          0,
        ),
        onBudgetBalance: accounts
          .filter(account => account.offbudget === 0)
          .reduce((total, account) => total + account.balance, 0),
        accounts,
      };
    },
    get_cash_flow: async input => {
      const value = limitedDateRangeSchema.parse(input);
      const result = await db.first<{
        income: number;
        expenses: number;
      }>(
        `SELECT
           COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS income,
           COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0) AS expenses
         FROM transactions t
         JOIN accounts a ON a.id = t.acct AND a.tombstone = 0
        WHERE t.tombstone = 0
          AND t.isParent = 0
          AND t.starting_balance_flag = 0
          AND t.transferred_id IS NULL
          AND a.offbudget = 0
          AND t.date BETWEEN ? AND ?`,
        [dateToNumber(value.startDate), dateToNumber(value.endDate)],
      );
      const income = result?.income ?? 0;
      const expenses = result?.expenses ?? 0;
      return {
        currency: 'BRL',
        ...value,
        income,
        expenses,
        net: income - expenses,
      };
    },
    get_spending_by_category: async input => {
      const value = limitedDateRangeSchema
        .extend({ limit: z.number().int().min(1).max(50).default(15) })
        .parse(input);
      const categories = await db.all<{
        categoryId: string | null;
        category: string;
        group: string | null;
        amount: number;
        transactionCount: number;
      }>(
        `SELECT c.id AS categoryId,
                COALESCE(c.name, 'Sem categoria') AS category,
                g.name AS "group",
                -SUM(t.amount) AS amount,
                COUNT(*) AS transactionCount
           FROM transactions t
           JOIN accounts a ON a.id = t.acct AND a.tombstone = 0
           LEFT JOIN category_mapping cm ON cm.id = t.category
           LEFT JOIN categories c ON c.id = cm.transferId AND c.tombstone = 0
           LEFT JOIN category_groups g ON g.id = c.cat_group AND g.tombstone = 0
          WHERE t.tombstone = 0
            AND t.isParent = 0
            AND t.starting_balance_flag = 0
            AND t.transferred_id IS NULL
            AND a.offbudget = 0
            AND t.amount < 0
            AND t.date BETWEEN ? AND ?
          GROUP BY c.id, c.name, g.name
          ORDER BY amount DESC`,
        [dateToNumber(value.startDate), dateToNumber(value.endDate)],
      );
      const returnedCategories = categories.slice(0, value.limit);
      return {
        categories: returnedCategories,
        coverage: {
          totalCount: categories.length,
          returnedCount: returnedCategories.length,
          complete: returnedCategories.length >= categories.length,
          hasMore: returnedCategories.length < categories.length,
        },
      };
    },
    search_transactions: async input => {
      const value = limitedDateRangeSchema
        .extend({
          query: z.string().trim().max(120).optional(),
          accountId: z.string().optional(),
          categoryId: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(30),
        })
        .parse(input);
      const filters = [
        't.tombstone = 0',
        't.isParent = 0',
        't.date BETWEEN ? AND ?',
      ];
      const params: Array<string | number> = [
        dateToNumber(value.startDate),
        dateToNumber(value.endDate),
      ];
      if (value.query) {
        filters.push(
          `(LOWER(COALESCE(p.name, '')) LIKE ? OR LOWER(COALESCE(t.notes, '')) LIKE ? OR LOWER(COALESCE(t.imported_description, '')) LIKE ?)`,
        );
        const query = `%${value.query.toLowerCase()}%`;
        params.push(query, query, query);
      }
      if (value.accountId) {
        filters.push('t.acct = ?');
        params.push(value.accountId);
      }
      if (value.categoryId) {
        filters.push('cm.transferId = ?');
        params.push(value.categoryId);
      }
      const total = await db.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM transactions t
           JOIN accounts a ON a.id = t.acct AND a.tombstone = 0
           LEFT JOIN payee_mapping pm ON pm.id = t.description
           LEFT JOIN payees p ON p.id = pm.targetId AND p.tombstone = 0
           LEFT JOIN category_mapping cm ON cm.id = t.category
          WHERE ${filters.join(' AND ')}`,
        params,
      );
      const rows = await db.all(
        `SELECT t.id, t.date, t.amount, t.notes,
                a.id AS accountId, a.name AS account,
                p.name AS payee,
                c.id AS categoryId, c.name AS category,
                CASE WHEN t.transferred_id IS NULL THEN 0 ELSE 1 END AS isTransfer
           FROM transactions t
           JOIN accounts a ON a.id = t.acct AND a.tombstone = 0
           LEFT JOIN payee_mapping pm ON pm.id = t.description
           LEFT JOIN payees p ON p.id = pm.targetId AND p.tombstone = 0
           LEFT JOIN category_mapping cm ON cm.id = t.category
           LEFT JOIN categories c ON c.id = cm.transferId AND c.tombstone = 0
          WHERE ${filters.join(' AND ')}
          ORDER BY t.date DESC, t.sort_order DESC
          LIMIT ?`,
        [...params, value.limit],
      );
      const totalCount = total?.count ?? 0;
      return {
        rows,
        coverage: {
          totalCount,
          returnedCount: rows.length,
          complete: rows.length >= totalCount,
          hasMore: rows.length < totalCount,
        },
      };
    },
    get_budget_month: async input => {
      const { month } = z
        .object({ month: z.string().regex(/^\d{4}-\d{2}$/) })
        .parse(input);
      const dbMonth = Number(month.replace('-', ''));
      const preference = await db.first<{ value: string }>(
        `SELECT value FROM preferences WHERE id = 'budgetType'`,
      );
      const table =
        preference?.value === 'tracking' ? 'reflect_budgets' : 'zero_budgets';
      const start = dbMonth * 100 + 1;
      const end = dbMonth * 100 + 31;
      const categories = await db.all<{
        categoryId: string;
        category: string;
        group: string;
        isIncome: 0 | 1;
        budgeted: number;
        spent: number;
      }>(
        `SELECT c.id AS categoryId, c.name AS category, g.name AS "group",
                c.is_income AS isIncome,
                COALESCE(b.amount, 0) AS budgeted,
                COALESCE(SUM(CASE WHEN t.transferred_id IS NULL THEN t.amount ELSE 0 END), 0) AS spent
           FROM categories c
           JOIN category_groups g ON g.id = c.cat_group AND g.tombstone = 0
           LEFT JOIN ${table} b ON b.category = c.id AND b.month = ?
           LEFT JOIN category_mapping cm ON cm.transferId = c.id
           LEFT JOIN transactions t
             ON t.category = cm.id
            AND t.tombstone = 0
            AND t.isParent = 0
            AND t.date BETWEEN ? AND ?
          WHERE c.tombstone = 0 AND c.hidden = 0
          GROUP BY c.id, c.name, g.name, c.is_income, b.amount
          ORDER BY g.sort_order, c.sort_order`,
        [dbMonth, start, end],
      );
      return { month, budgetType: preference?.value ?? 'envelope', categories };
    },
    get_credit_card_statements: async input => {
      const value = z
        .object({
          accountId: z.string().optional(),
          limit: z.number().int().min(1).max(36).default(12),
        })
        .parse(input);
      const accounts = await db.all<{ id: string; name: string }>(
        `SELECT id, name
           FROM accounts
          WHERE tombstone = 0 AND closed = 0
            AND closing_day IS NOT NULL AND due_day IS NOT NULL
            ${value.accountId ? 'AND id = ?' : ''}
          ORDER BY name`,
        value.accountId ? [value.accountId] : [],
      );
      const allStatements = (
        await Promise.all(
          accounts.map(async account =>
            (await getStatements({ accountId: account.id })).map(statement => ({
              ...statement,
              accountId: account.id,
              account: account.name,
            })),
          ),
        )
      )
        .flat()
        .sort((a, b) => b.end_date.localeCompare(a.end_date));
      const sourceRows = await db.all<{
        id: string;
        pluggy_total_amount: number | null;
      }>(
        `SELECT id, pluggy_total_amount
           FROM statements
          WHERE tombstone = 0`,
      );
      const sourceByStatement = new Map(
        sourceRows.map(row => [row.id, row.pluggy_total_amount]),
      );
      const statements = allStatements.slice(0, value.limit).map(statement => ({
        ...statement,
        balanceSource:
          sourceByStatement.get(statement.id) != null
            ? ('bank_reported' as const)
            : ('computed_from_transactions' as const),
      }));
      return {
        currency: 'BRL',
        statements,
        coverage: {
          totalCount: allStatements.length,
          returnedCount: statements.length,
          complete: statements.length >= allStatements.length,
          hasMore: statements.length < allStatements.length,
        },
      };
    },
    search_advisor_context: async input => {
      const value = z
        .object({
          query: z.string().trim().min(2).max(300),
          limit: z.number().int().min(1).max(20).default(8),
        })
        .parse(input);
      return searchAdvisorContext(
        value.query,
        value.limit,
        context.includeSensitiveMemory,
      );
    },
    get_advisor_profile: async () => {
      const now = Date.now();
      const memories = (await listMemoryFacts('confirmed')).filter(
        memory =>
          (memory.validFrom == null || memory.validFrom <= now) &&
          (memory.validTo == null || memory.validTo > now),
      );
      const goals = await listGoals();
      const kinds = new Set(memories.map(memory => memory.kind));
      return {
        memories: context.includeSensitiveMemory
          ? memories
          : memories.filter(memory => memory.sensitivity === 'normal'),
        goals,
        advice: await listAdviceRecords(),
        missingContext: [
          !kinds.has('monthly_income') && 'renda e estabilidade',
          !kinds.has('life_stage') && 'estágio de vida',
          !kinds.has('family_context') && 'contexto familiar e dependentes',
          !kinds.has('risk_preference') && 'capacidade e tolerância a risco',
          goals.length === 0 && 'objetivos e prioridades',
        ].filter(Boolean),
      };
    },
    propose_memory: async input => {
      const value = z
        .object({
          kind: z.string().trim().min(2).max(80),
          value: z.unknown(),
          originalText: z.string().trim().max(500),
          sensitivity: z.enum(['normal', 'sensitive']).default('normal'),
          confidence: z.number().min(0).max(1).default(1),
        })
        .parse(input);
      const candidate = await createMemoryCandidate({
        ...value,
        sourceMessageId: context.sourceMessageId,
      });
      return {
        candidateId: candidate.id,
        status: candidate.status,
        requiresConfirmation: true,
      };
    },
    propose_advice: async input => {
      const value = z
        .object({
          title: z.string().trim().min(3).max(120),
          recommendation: z.string().trim().min(10).max(2_000),
          assumptions: z
            .array(z.string().trim().min(2).max(300))
            .max(10)
            .default([]),
          alternatives: z
            .array(z.string().trim().min(2).max(500))
            .max(8)
            .default([]),
          risks: z.array(z.string().trim().min(2).max(500)).max(8).default([]),
          followUpAt: z.number().int().positive().nullable().default(null),
        })
        .parse(input);
      const advice = await createAdviceRecord({
        conversationId: context.conversationId,
        ...value,
      });
      return {
        adviceId: advice.id,
        status: advice.status,
        requiresConfirmation: true,
      };
    },
  };
}
