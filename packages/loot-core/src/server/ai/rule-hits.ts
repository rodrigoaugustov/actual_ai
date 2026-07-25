import * as db from '#server/db';

export type PendingRuleHit = {
  hitId: string;
  transactionId: string;
  payeeName: string | null;
  amount: number;
  notes: string | null;
  importedPayee: string | null;
  categoryId: string;
};

export function parseRuleSampleTransactionIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function recordRuleHit(params: {
  ruleId: string;
  transactionId: string;
  categoryId: string;
}): Promise<string | null> {
  const meta = await db.first<{ id: string }>(
    `SELECT id
       FROM ai_rule_meta
      WHERE rule_id = ? AND status = 'approved' AND tombstone = 0
      LIMIT 1`,
    [params.ruleId],
  );
  if (!meta) return null;

  const existing = await db.first<{ id: string }>(
    `SELECT id
       FROM ai_rule_hits
      WHERE rule_meta_id = ? AND transaction_id = ? AND tombstone = 0`,
    [meta.id, params.transactionId],
  );
  if (existing) return existing.id;

  return db.insertWithUUID('ai_rule_hits', {
    rule_meta_id: meta.id,
    rule_id: params.ruleId,
    transaction_id: params.transactionId,
    category_id: params.categoryId,
    status: 'pending',
    rationale: null,
    audited_at: null,
    created_at: Date.now(),
    tombstone: 0,
  });
}

export async function recordRuleSampleHits(params: {
  ruleId: string;
  transactionIds: string[];
  categoryId: string;
}): Promise<void> {
  for (const transactionId of params.transactionIds) {
    await recordRuleHit({
      ruleId: params.ruleId,
      transactionId,
      categoryId: params.categoryId,
    });
  }
}

export async function getPendingRuleHits(
  ruleMetaId: string,
  limit = 100,
): Promise<PendingRuleHit[]> {
  return db.all<PendingRuleHit>(
    `SELECT h.id AS hitId,
            h.transaction_id AS transactionId,
            p.name AS payeeName,
            t.amount,
            t.notes,
            t.imported_description AS importedPayee,
            h.category_id AS categoryId
       FROM ai_rule_hits h
       JOIN transactions t ON t.id = h.transaction_id
       LEFT JOIN payees p ON p.id = t.description
      WHERE h.rule_meta_id = ?
        AND h.status = 'pending'
        AND h.tombstone = 0
        AND t.tombstone = 0
      ORDER BY h.created_at ASC
      LIMIT ?`,
    [ruleMetaId, limit],
  );
}

export async function resolveRuleHit(params: {
  hitId: string;
  status: 'confirmed' | 'corrected' | 'skipped';
  rationale?: string;
}): Promise<void> {
  await db.update('ai_rule_hits', {
    id: params.hitId,
    status: params.status,
    rationale: params.rationale ?? null,
    audited_at: Date.now(),
  });
}

/** A human correction is stronger evidence than an auditor verdict. Reset the
 * mature-rule counters so the next hits return to 100% sampling. */
export async function markRuleHitCorrectedByUser(params: {
  transactionId: string;
  finalCategoryId: string;
}): Promise<void> {
  const hits = await db.all<{ id: string; rule_meta_id: string }>(
    `SELECT id, rule_meta_id
       FROM ai_rule_hits
      WHERE transaction_id = ?
        AND category_id <> ?
        AND status <> 'corrected'
        AND tombstone = 0`,
    [params.transactionId, params.finalCategoryId],
  );

  for (const hit of hits) {
    await resolveRuleHit({
      hitId: hit.id,
      status: 'corrected',
      rationale: 'User manually changed the category.',
    });
    const meta = await db.first<{ corrected: number }>(
      'SELECT corrected FROM ai_rule_meta WHERE id = ?',
      [hit.rule_meta_id],
    );
    await db.update('ai_rule_meta', {
      id: hit.rule_meta_id,
      hits: 0,
      confirmed: 0,
      corrected: (meta?.corrected ?? 0) + 1,
    });
  }
}
