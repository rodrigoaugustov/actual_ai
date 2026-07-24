import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { batchUpdateTransactions } from '#server/transactions';
import { q } from '#shared/query';
import type {
  AiSuggestionForReview,
  AiSuggestionIndexEntry,
  AiSuggestionStatus,
} from '#types/models/ai';

export async function createSuggestion(params: {
  transactionId: string;
  categoryId: string | null;
  confidence: number;
  rationale: string;
  status: AiSuggestionStatus;
  runId?: string;
}): Promise<string> {
  return db.insertWithUUID('ai_suggestions', {
    transaction_id: params.transactionId,
    category_id: params.categoryId,
    confidence: params.confidence,
    rationale: params.rationale,
    status: params.status,
    run_id: params.runId ?? null,
    created_at: Date.now(),
    tombstone: 0,
  });
}

export async function getPendingSuggestions(): Promise<
  AiSuggestionForReview[]
> {
  const { data } = await aqlQuery(
    q('ai_suggestions')
      .filter({ status: 'pending' })
      .select([
        'id',
        { transactionId: 'transaction_id' },
        { categoryId: 'category_id' },
        'confidence',
        'rationale',
        'status',
        { runId: 'run_id' },
        { createdAt: 'created_at' },
        { accountName: 'transaction_id.account.name' },
        { payeeName: 'transaction_id.payee.name' },
        { notes: 'transaction_id.notes' },
        { amount: 'transaction_id.amount' },
        { date: 'transaction_id.date' },
      ])
      .orderBy({ created_at: 'desc' }),
  );
  return data as AiSuggestionForReview[];
}

/** Every non-rejected suggestion, keyed by transaction — what the register
 * uses to badge a transaction as AI-touched without loading the full
 * review-inbox shape (rationale, run id, etc). */
export async function getSuggestionsIndex(): Promise<AiSuggestionIndexEntry[]> {
  const { data } = await aqlQuery(
    q('ai_suggestions')
      .filter({ status: { $ne: 'rejected' } })
      .select([
        'id',
        { transactionId: 'transaction_id' },
        { categoryId: 'category_id' },
        'status',
      ]),
  );
  return data as AiSuggestionIndexEntry[];
}

export async function resolveSuggestion({
  id,
  action,
  correctedCategoryId,
}: {
  id: string;
  action: 'accept' | 'correct' | 'reject';
  correctedCategoryId?: string | null;
}): Promise<void> {
  const {
    data: [suggestion],
  } = await aqlQuery(q('ai_suggestions').filter({ id }).select('*'));
  if (!suggestion) return;

  if (action !== 'reject') {
    const categoryToApply =
      action === 'correct' ? correctedCategoryId : suggestion.category_id;

    const {
      data: [transaction],
    } = await aqlQuery(
      q('transactions').filter({ id: suggestion.transaction_id }).select('*'),
    );

    if (transaction) {
      await batchUpdateTransactions({
        updated: [{ id: transaction.id, category: categoryToApply ?? null }],
      });
    }
  }

  await db.update('ai_suggestions', {
    id,
    status: action === 'reject' ? 'rejected' : 'accepted',
  });
}
