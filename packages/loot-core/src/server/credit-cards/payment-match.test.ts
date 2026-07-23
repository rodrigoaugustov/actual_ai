import * as db from '#server/db';
import type { DbStatement } from '#server/db';

import { pairAsTransfer, suggestStatementPayment } from './payment-match';
import { ensureStatements } from './statements';

beforeEach(global.emptyDatabase());

async function prepareCard({
  closingDay = 25,
  dueDay = 5,
}: { closingDay?: number; dueDay?: number } = {}) {
  await db.insertAccount({ id: 'checking', name: 'checking' });
  await db.insertAccount({ id: 'card', name: 'card' });
  await db.update('accounts', {
    id: 'card',
    closing_day: closingDay,
    due_day: dueDay,
  });
  await db.insertPayee({ name: '', transfer_acct: 'checking' });
  await db.insertPayee({ name: '', transfer_acct: 'card' });
  await ensureStatements('card');
}

function getJanStatement(): DbStatement {
  return db.firstSync<DbStatement>(
    "SELECT * FROM statements WHERE acct = 'card' AND end_date = 20170125",
  )!;
}

describe('suggestStatementPayment', () => {
  it('finds nothing when there are no unlinked credits near the due date', async () => {
    await prepareCard();
    const statement = getJanStatement();

    const suggestion = suggestStatementPayment(statement, -50000);

    expect(suggestion).toEqual({
      cardTransactionId: null,
      counterpartTransactionId: null,
    });
  });

  it('finds the card-side credit closest to the target amount, and its counterpart in another account', async () => {
    await prepareCard();
    const statement = getJanStatement();

    // A decoy credit further from the target amount
    await db.insertTransaction({
      id: 'decoy',
      account: 'card',
      amount: 10000,
      date: '2017-02-03',
    });
    // The real payment credit, closer to the target
    await db.insertTransaction({
      id: 'payment-card-side',
      account: 'card',
      amount: 50000,
      date: '2017-02-04',
    });
    // Its counterpart debit in checking
    await db.insertTransaction({
      id: 'payment-checking-side',
      account: 'checking',
      amount: -50000,
      date: '2017-02-04',
    });

    const suggestion = suggestStatementPayment(statement, -50000);

    expect(suggestion).toEqual({
      cardTransactionId: 'payment-card-side',
      counterpartTransactionId: 'payment-checking-side',
    });
  });

  it('returns only the card-side transaction when no counterpart account is tracked', async () => {
    await prepareCard();
    const statement = getJanStatement();

    await db.insertTransaction({
      id: 'payment-card-side',
      account: 'card',
      amount: 50000,
      date: '2017-02-04',
    });

    const suggestion = suggestStatementPayment(statement, -50000);

    expect(suggestion).toEqual({
      cardTransactionId: 'payment-card-side',
      counterpartTransactionId: null,
    });
  });

  it('ignores candidates already linked as a transfer', async () => {
    await prepareCard();
    const statement = getJanStatement();

    await db.insertPayee({ name: 'someone' });
    await db.insertTransaction({
      id: 'already-transfer',
      account: 'card',
      amount: 50000,
      date: '2017-02-04',
      transfer_id: 'whatever',
    });

    const suggestion = suggestStatementPayment(statement, -50000);

    expect(suggestion.cardTransactionId).toBe(null);
  });

  it('falls back to date proximity to the due date when the target amount is unknown', async () => {
    await prepareCard();
    const statement = getJanStatement();

    await db.insertTransaction({
      id: 'far',
      account: 'card',
      amount: 10000,
      date: '2017-02-20',
    });
    await db.insertTransaction({
      id: 'near-due-date',
      account: 'card',
      amount: 30000,
      date: '2017-02-06',
    });

    // due_date is 2017-02-05
    const suggestion = suggestStatementPayment(statement, 0);

    expect(suggestion.cardTransactionId).toBe('near-due-date');
  });
});

describe('pairAsTransfer', () => {
  it('links both transactions as a transfer and clears their categories', async () => {
    await prepareCard();
    await db.insertCategoryGroup({ id: 'group1', name: 'group1' });
    const catId = await db.insertCategory({
      name: 'misc',
      cat_group: 'group1',
    });

    await db.insertTransaction({
      id: 'card-side',
      account: 'card',
      amount: 50000,
      date: '2017-02-04',
      category: catId,
    });
    await db.insertTransaction({
      id: 'checking-side',
      account: 'checking',
      amount: -50000,
      date: '2017-02-04',
      category: catId,
    });

    await pairAsTransfer('card-side', 'checking-side');

    const cardSide = await db.getTransaction('card-side');
    const checkingSide = await db.getTransaction('checking-side');

    expect(cardSide!.transfer_id).toBe('checking-side');
    expect(checkingSide!.transfer_id).toBe('card-side');
    expect(cardSide!.category).toBe(null);
    expect(checkingSide!.category).toBe(null);
  });

  it('rejects a pair that is not a valid transfer', async () => {
    await prepareCard();

    await db.insertTransaction({
      id: 'card-side',
      account: 'card',
      amount: 50000,
      date: '2017-02-04',
    });
    await db.insertTransaction({
      id: 'checking-side',
      account: 'checking',
      amount: -40000, // does not zero out
      date: '2017-02-04',
    });

    await expect(pairAsTransfer('card-side', 'checking-side')).rejects.toThrow();
  });
});
