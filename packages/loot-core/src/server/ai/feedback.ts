import { buildCacheKey, normalizePayee } from '@actual-app/ai';
import type { ClassifierGoldenCase } from '@actual-app/ai';

import * as db from '#server/db';
import type { TransactionEntity } from '#types/models';
import type { AiFeedbackSource } from '#types/models/ai';

import { getAiConfig } from './config';
import { markRuleHitCorrectedByUser } from './rule-hits';

type FeedbackTransaction = {
  id: string;
  account: string;
  amount: number;
  category: string | null;
  payeeName: string | null;
};

export type LearnedCategory = {
  categoryId: string;
  confidence: number;
  samples: number;
};

const SOURCE_WEIGHT: Record<AiFeedbackSource, number> = {
  manual: 3,
  corrected: 3,
  auto_applied_overridden: 3,
  accepted: 2,
  rejected: 0,
};
const REJECTION_WEIGHT = 3;

async function getFeedbackTransaction(
  transactionId: string,
): Promise<FeedbackTransaction | null> {
  return db.first<FeedbackTransaction>(
    `SELECT t.id,
            t.acct AS account,
            t.amount,
            t.category,
            p.name AS payeeName
       FROM transactions t
       LEFT JOIN payees p ON p.id = t.description
      WHERE t.id = ? AND t.tombstone = 0`,
    [transactionId],
  );
}

export async function recordFeedback(params: {
  transactionId: string;
  source: AiFeedbackSource;
  suggestedCategoryId?: string | null;
  finalCategoryId?: string | null;
  suggestionId?: string | null;
  runId?: string | null;
}): Promise<string | null> {
  const transaction = await getFeedbackTransaction(params.transactionId);
  if (!transaction) return null;

  const payeeName = transaction.payeeName ?? '';
  const id = await db.insertWithUUID('ai_feedback', {
    transaction_id: transaction.id,
    account_id: transaction.account,
    payee_name: payeeName,
    normalized_payee: normalizePayee(payeeName),
    amount: transaction.amount,
    suggested_category_id: params.suggestedCategoryId ?? null,
    final_category_id: params.finalCategoryId ?? null,
    source: params.source,
    suggestion_id: params.suggestionId ?? null,
    run_id: params.runId ?? null,
    created_at: Date.now(),
    tombstone: 0,
  });
  if (getAiConfig().enabled) {
    scheduleRuleMiningFromFeedback();
  }
  return id;
}

function scheduleRuleMiningFromFeedback(): void {
  void import('./rule-miner')
    .then(({ maybeMineRuleProposals }) => maybeMineRuleProposals())
    .catch(() => {
      // Feedback capture must never fail because optional background mining
      // could not start. The miner logs its own operational failures.
    });
}

export async function recordManualCategorizationFeedback(
  before: TransactionEntity,
  after: TransactionEntity,
): Promise<boolean> {
  if (!after.category || before.category === after.category) return false;

  const suggestion = await db.first<{
    id: string;
    category_id: string | null;
    status: string;
    run_id: string | null;
  }>(
    `SELECT id, category_id, status, run_id
       FROM ai_suggestions
      WHERE transaction_id = ? AND tombstone = 0
      ORDER BY created_at DESC
      LIMIT 1`,
    [after.id],
  );

  // Pending suggestions are resolved by the dedicated review flow, which
  // records richer accepted/corrected feedback and avoids a duplicate row.
  if (suggestion?.status === 'pending') return false;

  const source: AiFeedbackSource =
    suggestion?.status === 'auto_applied' &&
    suggestion.category_id !== after.category
      ? 'auto_applied_overridden'
      : 'manual';

  await recordFeedback({
    transactionId: after.id,
    source,
    suggestedCategoryId: suggestion?.category_id,
    finalCategoryId: after.category,
    suggestionId: suggestion?.id,
    runId: suggestion?.run_id,
  });
  await markRuleHitCorrectedByUser({
    transactionId: after.id,
    finalCategoryId: after.category,
  });
  return true;
}

export async function getFeedbackExamples(
  limit = 30,
): Promise<Array<{ payeeName: string; categoryName: string }>> {
  return db.all<{ payeeName: string; categoryName: string }>(
    `SELECT f.payee_name AS payeeName, c.name AS categoryName
       FROM ai_feedback f
       JOIN categories c ON c.id = f.final_category_id
      WHERE f.tombstone = 0
        AND f.final_category_id IS NOT NULL
        AND c.tombstone = 0
      ORDER BY f.created_at DESC
      LIMIT ?`,
    [limit],
  );
}

export async function getRejectedExamples(
  limit = 30,
): Promise<Array<{ payeeName: string; categoryName: string }>> {
  return db.all<{ payeeName: string; categoryName: string }>(
    `SELECT f.payee_name AS payeeName, c.name AS categoryName
       FROM ai_feedback f
       JOIN categories c ON c.id = f.suggested_category_id
      WHERE f.tombstone = 0
        AND f.source = 'rejected'
        AND f.suggested_category_id IS NOT NULL
        AND c.tombstone = 0
      ORDER BY f.created_at DESC
      LIMIT ?`,
    [limit],
  );
}

export async function getClassifierGoldenSet(
  limit = 1000,
): Promise<ClassifierGoldenCase[]> {
  return db.all<ClassifierGoldenCase>(
    `SELECT transaction_id AS id,
            final_category_id AS expectedCategoryId,
            CASE
              WHEN source IN ('rejected', 'corrected')
              THEN suggested_category_id
              ELSE NULL
            END AS rejectedCategoryId
       FROM ai_feedback
      WHERE tombstone = 0
        AND (
          final_category_id IS NOT NULL
          OR (source = 'rejected' AND suggested_category_id IS NOT NULL)
        )
      ORDER BY created_at DESC
      LIMIT ?`,
    [limit],
  );
}

export async function getLearnedCategories(): Promise<
  Map<string, LearnedCategory>
> {
  const rows = await db.all<{
    accountId: string;
    payeeName: string;
    amount: number;
    finalCategoryId: string | null;
    suggestedCategoryId: string | null;
    source: AiFeedbackSource;
  }>(
    `SELECT account_id AS accountId,
            payee_name AS payeeName,
            amount,
            final_category_id AS finalCategoryId,
            suggested_category_id AS suggestedCategoryId,
            source
       FROM ai_feedback
      WHERE tombstone = 0
        AND (final_category_id IS NOT NULL OR source = 'rejected')
      ORDER BY created_at DESC
      LIMIT 1000`,
  );

  const scores = new Map<
    string,
    {
      byCategory: Map<string, number>;
      evidenceWeight: number;
      positiveSamples: number;
    }
  >();
  for (const row of rows) {
    const key = buildCacheKey({
      account: row.accountId,
      payeeName: row.payeeName,
      amountCents: row.amount,
    });
    const entry = scores.get(key) ?? {
      byCategory: new Map<string, number>(),
      evidenceWeight: 0,
      positiveSamples: 0,
    };
    if (row.source === 'rejected' && row.suggestedCategoryId) {
      entry.byCategory.set(
        row.suggestedCategoryId,
        (entry.byCategory.get(row.suggestedCategoryId) ?? 0) - REJECTION_WEIGHT,
      );
      entry.evidenceWeight += REJECTION_WEIGHT;
    } else if (row.finalCategoryId) {
      const weight = SOURCE_WEIGHT[row.source];
      entry.byCategory.set(
        row.finalCategoryId,
        (entry.byCategory.get(row.finalCategoryId) ?? 0) + weight,
      );
      entry.evidenceWeight += weight;
      entry.positiveSamples++;
    }
    scores.set(key, entry);
  }

  const learned = new Map<string, LearnedCategory>();
  for (const [key, entry] of scores) {
    const ranked = [...entry.byCategory.entries()].sort(
      (left, right) => right[1] - left[1],
    );
    const [categoryId, topWeight] = ranked[0] ?? [];
    if (
      categoryId &&
      entry.positiveSamples >= 2 &&
      entry.evidenceWeight > 0 &&
      topWeight / entry.evidenceWeight >= 0.8
    ) {
      learned.set(key, {
        categoryId,
        confidence: topWeight / entry.evidenceWeight,
        samples: entry.positiveSamples,
      });
    }
  }
  return learned;
}
