import * as db from '#server/db';

import {
  buildMerchantClusterId,
  getRelevantClassifierEvidence,
} from './classifier-context';
import { recordFeedback } from './feedback';

beforeEach(global.emptyDatabase());

describe('classifier merchant context', () => {
  it('clusters repeated merchant descriptions while ignoring dynamic digits', () => {
    expect(
      buildMerchantClusterId({
        id: 'one',
        payeeName: 'DuoGourmet',
        importedPayee: 'DUOGOURMET 123456',
        notes: null,
      }),
    ).toBe(
      buildMerchantClusterId({
        id: 'two',
        payeeName: 'Duo Gourmet',
        importedPayee: 'DUOGOURMET 987654',
        notes: null,
      }),
    );
  });

  it('retrieves accepted and rejected evidence for the same merchant', async () => {
    await db.insertAccount({ id: 'checking', name: 'Checking' });
    await db.insertCategoryGroup({ id: 'food', name: 'Food' });
    await db.insertCategory({
      id: 'restaurants',
      name: 'Restaurants',
      cat_group: 'food',
    });
    await db.insertPayee({ id: 'duo', name: 'DuoGourmet' });
    await db.insertTransaction({
      id: 'accepted',
      account: 'checking',
      payee: 'duo',
      imported_payee: 'DUOGOURMET CLUB',
      category: 'restaurants',
      amount: -5000,
      date: '2026-07-01',
    });
    await recordFeedback({
      transactionId: 'accepted',
      source: 'accepted',
      suggestedCategoryId: 'restaurants',
      finalCategoryId: 'restaurants',
    });
    await db.insertTransaction({
      id: 'rejected',
      account: 'checking',
      payee: 'duo',
      imported_payee: 'DUOGOURMET CLUB',
      amount: -6000,
      date: '2026-07-02',
    });
    await recordFeedback({
      transactionId: 'rejected',
      source: 'rejected',
      suggestedCategoryId: 'restaurants',
    });

    const evidence = await getRelevantClassifierEvidence(
      [
        {
          id: 'new',
          payeeName: 'Duo Gourmet',
          importedPayee: 'DUOGOURMET CLUB',
          notes: null,
        },
      ],
      0.8,
    );

    expect(evidence.map(item => item.outcome)).toEqual(
      expect.arrayContaining(['accepted', 'rejected']),
    );
    expect(evidence.every(item => item.similarity >= 0.7)).toBe(true);
  });
});
