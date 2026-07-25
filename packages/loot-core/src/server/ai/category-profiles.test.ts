import * as db from '#server/db';

import {
  getCategoryDescriptions,
  listCategoryProfiles,
  upsertCategoryProfile,
} from './category-profiles';

beforeEach(global.emptyDatabase());

async function prepareCategory() {
  await db.insertCategoryGroup({ id: 'food', name: 'Food' });
  await db.insertCategory({
    id: 'restaurants',
    name: 'Restaurants',
    cat_group: 'food',
  });
}

describe('AI category profiles', () => {
  it('creates, updates and removes a category description', async () => {
    await prepareCategory();

    const created = await upsertCategoryProfile({
      categoryId: 'restaurants',
      description: ' Meals eaten away from home. ',
    });
    expect(created?.description).toBe('Meals eaten away from home.');
    expect(await getCategoryDescriptions()).toEqual(
      new Map([['restaurants', 'Meals eaten away from home.']]),
    );

    await upsertCategoryProfile({
      categoryId: 'restaurants',
      description: 'Restaurants and delivery.',
    });
    expect(await listCategoryProfiles()).toMatchObject([
      {
        categoryId: 'restaurants',
        description: 'Restaurants and delivery.',
      },
    ]);

    expect(
      await upsertCategoryProfile({
        categoryId: 'restaurants',
        description: '',
      }),
    ).toBeNull();
    expect(await listCategoryProfiles()).toEqual([]);
  });

  it('rejects unknown categories and oversized descriptions', async () => {
    await expect(
      upsertCategoryProfile({
        categoryId: 'missing',
        description: 'Unknown.',
      }),
    ).rejects.toThrow('does not exist');

    await prepareCategory();
    await expect(
      upsertCategoryProfile({
        categoryId: 'restaurants',
        description: 'x'.repeat(1001),
      }),
    ).rejects.toThrow('must not exceed');
  });
});
