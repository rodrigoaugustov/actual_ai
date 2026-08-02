import { send } from '@actual-app/core/platform/client/connection';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { beforeEach, vi } from 'vitest';

import {
  createBudgetAnalysisSpreadsheet,
  isBaseCategory,
} from './budget-analysis-spreadsheet';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));

const mockedSend = vi.mocked(send);

const makeCategory = (
  overrides: Partial<CategoryEntity> & Pick<CategoryEntity, 'id' | 'name'>,
): CategoryEntity => ({
  is_income: false,
  hidden: false,
  group: 'group1',
  ...overrides,
});

const visibleExpense = makeCategory({ id: 'c1', name: 'Groceries' });
const hiddenExpense = makeCategory({
  id: 'c2',
  name: 'Car Fund',
  hidden: true,
});
const incomeCategory = makeCategory({
  id: 'c3',
  name: 'Salary',
  is_income: true,
});
const hiddenIncome = makeCategory({
  id: 'c4',
  name: 'Hidden Income',
  is_income: true,
  hidden: true,
});

const all = [visibleExpense, hiddenExpense, incomeCategory, hiddenIncome];

function filterBaseCategories(
  categories: CategoryEntity[],
  showHiddenCategories: boolean,
): CategoryEntity[] {
  return categories.filter(cat => isBaseCategory(cat, showHiddenCategories));
}

describe('createBudgetAnalysisSpreadsheet', () => {
  beforeEach(() => {
    mockedSend.mockReset();
  });

  describe('hidden category filtering', () => {
    it('excludes hidden categories when showHiddenCategories is false', () => {
      const result = filterBaseCategories(all, false);
      expect(result).toContain(visibleExpense);
      expect(result).not.toContain(hiddenExpense);
    });

    it('includes hidden expense categories when showHiddenCategories is true', () => {
      const result = filterBaseCategories(all, true);
      expect(result).toContain(visibleExpense);
      expect(result).toContain(hiddenExpense);
    });

    it('always excludes income categories regardless of showHiddenCategories', () => {
      const resultFalse = filterBaseCategories(all, false);
      const resultTrue = filterBaseCategories(all, true);
      expect(resultFalse).not.toContain(incomeCategory);
      expect(resultFalse).not.toContain(hiddenIncome);
      expect(resultTrue).not.toContain(incomeCategory);
      expect(resultTrue).not.toContain(hiddenIncome);
    });

    it('returns only visible expense categories by default', () => {
      const result = filterBaseCategories(all, false);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(visibleExpense);
    });

    it('returns all expense categories when flag is true', () => {
      const result = filterBaseCategories(all, true);
      expect(result).toHaveLength(2);
      expect(result).toContain(visibleExpense);
      expect(result).toContain(hiddenExpense);
    });
  });

  it('keeps spent and the balance calculation unchanged', async () => {
    mockedSend.mockImplementation(async method => {
      if (method === 'get-categories') {
        return { list: [visibleExpense], grouped: [] };
      }

      if (method === 'envelope-budget-month') {
        return [
          { name: 'sheet!budget-c1', value: 10_000 },
          { name: 'sheet!sum-amount-c1', value: -15_000 },
          { name: 'sheet!leftover-c1', value: -5_000 },
          { name: 'sheet!carryover-c1', value: false },
        ];
      }

      throw new Error(`Unexpected method: ${method}`);
    });

    let result: {
      intervalData: Array<{
        spent: number;
        balance: number;
      }>;
      totalSpent: number;
    } | null = null;
    const calculate = createBudgetAnalysisSpreadsheet({
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });

    await calculate(null as never, data => {
      result = data;
    });

    expect(result).toMatchObject({
      totalSpent: -15_000,
      intervalData: [
        {
          spent: -15_000,
          // This remains budgeted + spent + runningBalance.
          balance: -5_000,
        },
      ],
    });
  });
});
