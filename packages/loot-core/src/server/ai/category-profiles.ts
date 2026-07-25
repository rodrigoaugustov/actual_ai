import * as db from '#server/db';
import type { AiCategoryProfileEntity } from '#types/models/ai';

const MAX_DESCRIPTION_LENGTH = 1000;

type CategoryProfileRow = {
  id: string;
  categoryId: string;
  description: string;
  updatedAt: number;
  tombstone: number;
};

function toEntity(row: CategoryProfileRow): AiCategoryProfileEntity {
  return {
    id: row.id,
    categoryId: row.categoryId,
    description: row.description,
    updatedAt: row.updatedAt,
    tombstone: row.tombstone === 1,
  };
}

export async function listCategoryProfiles(): Promise<
  AiCategoryProfileEntity[]
> {
  const rows = await db.all<CategoryProfileRow>(
    `SELECT id,
            category_id AS categoryId,
            description,
            updated_at AS updatedAt,
            tombstone
       FROM ai_category_profiles
      WHERE tombstone = 0
      ORDER BY category_id`,
  );
  return rows.map(toEntity);
}

export async function getCategoryDescriptions(): Promise<Map<string, string>> {
  const profiles = await listCategoryProfiles();
  return new Map(
    profiles.map(profile => [profile.categoryId, profile.description]),
  );
}

export async function upsertCategoryProfile({
  categoryId,
  description,
}: {
  categoryId: string;
  description: string;
}): Promise<AiCategoryProfileEntity | null> {
  const normalizedDescription = description.trim();
  if (normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Category description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }

  const category = await db.first<{ id: string }>(
    `SELECT id
       FROM categories
      WHERE id = ? AND tombstone = 0`,
    [categoryId],
  );
  if (!category) {
    throw new Error('Cannot describe a category that does not exist.');
  }

  const existing = await db.first<CategoryProfileRow>(
    `SELECT id,
            category_id AS categoryId,
            description,
            updated_at AS updatedAt,
            tombstone
       FROM ai_category_profiles
      WHERE category_id = ?`,
    [categoryId],
  );
  const updatedAt = Date.now();

  if (!normalizedDescription) {
    if (existing) {
      await db.update('ai_category_profiles', {
        id: existing.id,
        description: '',
        updated_at: updatedAt,
        tombstone: 1,
      });
    }
    return null;
  }

  if (existing) {
    await db.update('ai_category_profiles', {
      id: existing.id,
      description: normalizedDescription,
      updated_at: updatedAt,
      tombstone: 0,
    });
    return {
      id: existing.id,
      categoryId,
      description: normalizedDescription,
      updatedAt,
      tombstone: false,
    };
  }

  const id = await db.insertWithUUID('ai_category_profiles', {
    id: categoryId,
    category_id: categoryId,
    description: normalizedDescription,
    updated_at: updatedAt,
    tombstone: 0,
  });
  return {
    id,
    categoryId,
    description: normalizedDescription,
    updatedAt,
    tombstone: false,
  };
}
