import * as db from '#server/db';

import {
  createSuggestion,
  getPendingSuggestions,
  getSuggestionsIndex,
  resolveSuggestion,
} from './suggestions';

beforeEach(global.emptyDatabase());

async function prepare() {
  await db.insertAccount({ id: 'checking', name: 'checking' });
  await db.insertPayee({ id: 'payee1', name: 'Extra' });
  await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'group1',
  });
  await db.insertCategory({ id: 'other', name: 'Other', cat_group: 'group1' });
  await db.insertTransaction({
    id: 'txn1',
    account: 'checking',
    payee: 'payee1',
    amount: -5000,
    date: '2026-01-05',
  });
}

describe('createSuggestion / getPendingSuggestions', () => {
  it('lists only pending suggestions, most recent first', async () => {
    await prepare();
    await createSuggestion({
      transactionId: 'txn1',
      categoryId: 'groceries',
      confidence: 0.6,
      rationale: 'Known grocery payee',
      status: 'pending',
    });
    await createSuggestion({
      transactionId: 'txn1',
      categoryId: 'other',
      confidence: 0.95,
      rationale: 'auto',
      status: 'auto_applied',
    });

    const pending = await getPendingSuggestions();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      transactionId: 'txn1',
      categoryId: 'groceries',
      status: 'pending',
      payeeName: 'Extra',
      amount: -5000,
      date: '2026-01-05',
    });
  });
});

describe('getSuggestionsIndex', () => {
  it('includes pending and auto_applied entries but not rejected ones', async () => {
    await prepare();
    await db.insertTransaction({
      id: 'txn2',
      account: 'checking',
      payee: 'payee1',
      amount: -2000,
      date: '2026-01-06',
    });
    await createSuggestion({
      transactionId: 'txn1',
      categoryId: 'groceries',
      confidence: 0.6,
      rationale: 'x',
      status: 'pending',
    });
    const rejectedId = await createSuggestion({
      transactionId: 'txn2',
      categoryId: 'other',
      confidence: 0.6,
      rationale: 'x',
      status: 'pending',
    });
    await resolveSuggestion({ id: rejectedId, action: 'reject' });

    const index = await getSuggestionsIndex();

    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({
      transactionId: 'txn1',
      categoryId: 'groceries',
      status: 'pending',
    });
    expect(typeof index[0].id).toBe('string');
  });
});

describe('resolveSuggestion', () => {
  it('accept applies the suggested category to the transaction', async () => {
    await prepare();
    const id = await createSuggestion({
      transactionId: 'txn1',
      categoryId: 'groceries',
      confidence: 0.6,
      rationale: 'x',
      status: 'pending',
    });

    await resolveSuggestion({ id, action: 'accept' });

    const transaction = await db.first<{ category: string }>(
      'SELECT category FROM transactions WHERE id = ?',
      ['txn1'],
    );
    expect(transaction?.category).toBe('groceries');
    expect(await getPendingSuggestions()).toHaveLength(0);
  });

  it('correct applies a different category than the one suggested', async () => {
    await prepare();
    const id = await createSuggestion({
      transactionId: 'txn1',
      categoryId: 'groceries',
      confidence: 0.6,
      rationale: 'x',
      status: 'pending',
    });

    await resolveSuggestion({
      id,
      action: 'correct',
      correctedCategoryId: 'other',
    });

    const transaction = await db.first<{ category: string }>(
      'SELECT category FROM transactions WHERE id = ?',
      ['txn1'],
    );
    expect(transaction?.category).toBe('other');
  });

  it('reject leaves the transaction uncategorized', async () => {
    await prepare();
    const id = await createSuggestion({
      transactionId: 'txn1',
      categoryId: 'groceries',
      confidence: 0.6,
      rationale: 'x',
      status: 'pending',
    });

    await resolveSuggestion({ id, action: 'reject' });

    const transaction = await db.first<{ category: string | null }>(
      'SELECT category FROM transactions WHERE id = ?',
      ['txn1'],
    );
    expect(transaction?.category).toBeNull();
    expect(await getPendingSuggestions()).toHaveLength(0);
  });
});
