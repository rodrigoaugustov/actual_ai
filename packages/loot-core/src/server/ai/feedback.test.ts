import * as db from '#server/db';

import {
  getClassifierGoldenSet,
  getFeedbackExamples,
  getLearnedCategories,
  getRejectedExamples,
  recordFeedback,
} from './feedback';

beforeEach(global.emptyDatabase());

async function prepare() {
  await db.insertAccount({ id: 'checking', name: 'Checking' });
  await db.insertPayee({ id: 'market', name: 'Mercado São João' });
  await db.insertCategoryGroup({ id: 'expenses', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'expenses',
  });
  for (let index = 1; index <= 2; index++) {
    await db.insertTransaction({
      id: `txn${index}`,
      account: 'checking',
      payee: 'market',
      amount: -5000,
      date: `2026-01-0${index}`,
      category: 'groceries',
    });
  }
}

it('learns a stable category after two explicit user decisions', async () => {
  await prepare();
  await recordFeedback({
    transactionId: 'txn1',
    source: 'manual',
    finalCategoryId: 'groceries',
  });
  await recordFeedback({
    transactionId: 'txn2',
    source: 'corrected',
    suggestedCategoryId: null,
    finalCategoryId: 'groceries',
  });

  const learned = await getLearnedCategories();
  expect(learned).toHaveLength(1);
  expect([...learned.values()][0]).toMatchObject({
    categoryId: 'groceries',
    samples: 2,
    confidence: 1,
  });
});

it('exposes final decisions as few-shot examples', async () => {
  await prepare();
  await recordFeedback({
    transactionId: 'txn1',
    source: 'accepted',
    suggestedCategoryId: 'groceries',
    finalCategoryId: 'groceries',
  });

  expect(await getFeedbackExamples()).toEqual([
    { payeeName: 'Mercado São João', categoryName: 'Groceries' },
  ]);
});

it('uses a rejection as negative evidence against a prior learned category', async () => {
  await prepare();
  await recordFeedback({
    transactionId: 'txn1',
    source: 'manual',
    finalCategoryId: 'groceries',
  });
  await recordFeedback({
    transactionId: 'txn2',
    source: 'manual',
    finalCategoryId: 'groceries',
  });
  await recordFeedback({
    transactionId: 'txn2',
    source: 'rejected',
    suggestedCategoryId: 'groceries',
    finalCategoryId: null,
  });

  expect(await getLearnedCategories()).toHaveLength(0);
  expect(await getRejectedExamples()).toEqual([
    { payeeName: 'Mercado São João', categoryName: 'Groceries' },
  ]);
  expect(await getClassifierGoldenSet()).toMatchObject([
    {
      expectedCategoryId: null,
      rejectedCategoryId: 'groceries',
    },
    {
      expectedCategoryId: 'groceries',
      rejectedCategoryId: null,
    },
    {
      expectedCategoryId: 'groceries',
      rejectedCategoryId: null,
    },
  ]);
});
