import { Timestamp } from '@actual-app/crdt';
import { vi } from 'vitest';

import * as connection from '#platform/server/connection';
import { createBudget } from '#server/budget/base';
import * as db from '#server/db';
import { handlers } from '#server/main';
import { runHandler } from '#server/mutators';
import * as sheet from '#server/sheet';
import { applyMessages } from '#server/sync';

describe('separateTransfersFromSpending preference', () => {
  beforeEach(async () => {
    await global.emptyDatabase()();
    await sheet.loadSpreadsheet(db);
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });
    await createBudget(['2026-01']);
  });

  it('persists local and remote changes without rebuilding the budget spreadsheet', async () => {
    const sendSpy = vi.spyOn(connection, 'send');
    const sheetName = 'budget202601';
    const totalTransfersNode = sheet
      .get()
      .getNode(`${sheetName}!total-transfers`);

    await runHandler(handlers['preferences/save'], {
      id: 'separateTransfersFromSpending',
      value: 'true',
    });

    await expect(
      db.first<{ value: string }>(
        'SELECT value FROM preferences WHERE id = ?',
        ['separateTransfersFromSpending'],
      ),
    ).resolves.toEqual({ value: 'true' });
    expect(sheet.get().getNode(`${sheetName}!total-transfers`)).toBe(
      totalTransfersNode,
    );

    const timestamp = Timestamp.send();
    if (timestamp == null) {
      throw new Error('CRDT timestamp was not initialized');
    }
    await applyMessages([
      {
        dataset: 'preferences',
        row: 'separateTransfersFromSpending',
        column: 'value',
        value: 'false',
        timestamp,
      },
    ]);

    await expect(
      db.first<{ value: string }>(
        'SELECT value FROM preferences WHERE id = ?',
        ['separateTransfersFromSpending'],
      ),
    ).resolves.toEqual({ value: 'false' });
    expect(sendSpy).toHaveBeenCalledWith('prefs-updated');
    expect(sheet.get().getNode(`${sheetName}!total-transfers`)).toBe(
      totalTransfersNode,
    );
  });

  it('notifies the client for every remote synced preference', async () => {
    const sendSpy = vi.spyOn(connection, 'send');
    const timestamp = Timestamp.send();
    if (timestamp == null) {
      throw new Error('CRDT timestamp was not initialized');
    }

    await applyMessages([
      {
        dataset: 'preferences',
        row: 'numberFormat',
        column: 'value',
        value: 'dot-comma',
        timestamp,
      },
    ]);

    expect(sendSpy).toHaveBeenCalledWith('prefs-updated');
  });
});
