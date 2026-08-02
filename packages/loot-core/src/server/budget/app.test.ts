import * as db from '#server/db';
import type { BudgetType } from '#server/prefs';
import * as sheet from '#server/sheet';
import { resolveName } from '#server/spreadsheet/util';

import { app } from './app';
import { createBudget } from './base';

describe('budget month payloads', () => {
  beforeEach(global.emptyDatabase());

  it.each([
    ['envelope', 'envelope-budget-month'],
    ['tracking', 'tracking-budget-month'],
  ] as const)(
    'includes total-transfers in the %s payload without category or group additions',
    async (budgetType, handlerName) => {
      await sheet.loadSpreadsheet(db);
      sheet.get().meta().budgetType = budgetType as BudgetType;
      await db.insertCategoryGroup({
        id: 'income-group',
        name: 'Income',
        is_income: 1,
      });
      await createBudget(['2026-01']);

      const payload = await app.handlers[handlerName]({ month: '2026-01' });
      const names = payload.map(item => item.name);

      expect(names).toContain(resolveName('budget202601', 'total-transfers'));
      expect(names).not.toContain('group-total-transfers');
      expect(names).not.toContain('category-total-transfers');
    },
  );
});
