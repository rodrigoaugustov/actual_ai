import {
  assertCanStartRun,
  buildCacheKey,
  classifierAgent,
  InMemoryResponseCache,
  redactPii,
  runWorkflow,
  WorkflowError,
} from '@actual-app/ai';
import type { ClassifierCandidate, ClassifierOutput } from '@actual-app/ai';

import * as connection from '#platform/server/connection';
import { logger } from '#platform/server/log';
import { aqlQuery } from '#server/aql';
import { batchUpdateTransactions } from '#server/transactions';
import { q } from '#shared/query';
import type { ClassifyOutcome } from '#types/models/ai';

import { getAiConfig } from './config';
import { buildProviderConfigForTier } from './fetch-client';
import { getSpendTodayUsd, recordRun } from './runs';
import { createSuggestion } from './suggestions';

const BATCH_SIZE = 50;
// Safety cap across the whole run, independent of the $/day budget: without
// it, a first sync of an account with years of history would keep looping
// (and spending) until assertCanStartRun finally trips. One pass can always
// pick up wherever this leaves off on the next run.
const MAX_TRANSACTIONS_PER_RUN = 500;
const HISTORY_LIMIT = 30;

// Session-scoped: within a large batch job this still avoids re-asking the
// model for the same payee/amount pair twice, and it costs nothing to keep
// around between calls. Cross-restart persistence is a follow-up — see
// ARCHITECTURE.md's note on the two-layer cache.
const responseCache = new InMemoryResponseCache<string | null>();

type PendingTransaction = {
  id: string;
  account: string;
  amount: number;
  date: string;
  notes: string | null;
  payeeName: string | null;
};

const PENDING_TRANSACTION_FIELDS = [
  'id',
  'account',
  'amount',
  'date',
  'notes',
  { payeeName: 'payee.name' },
] as const;

async function fetchPendingTransactions(
  accountId: string,
  limit: number,
): Promise<PendingTransaction[]> {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({
        account: accountId,
        category: null,
        transfer_id: null,
        is_parent: false,
      })
      .select([...PENDING_TRANSACTION_FIELDS])
      .limit(limit),
  );
  return data as PendingTransaction[];
}

/** Same shape as fetchPendingTransactions, but by explicit id list instead
 * of account — what the manual "classify now" trigger on the Uncategorized
 * screen uses, since that view spans every account. Transactions the user
 * already categorized (or that got re-categorized since the ids were
 * gathered client-side) are silently excluded rather than erroring. */
async function fetchTransactionsByIds(
  transactionIds: string[],
): Promise<PendingTransaction[]> {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({
        id: { $oneof: transactionIds },
        category: null,
        transfer_id: null,
        is_parent: false,
      })
      .select([...PENDING_TRANSACTION_FIELDS]),
  );
  return data as PendingTransaction[];
}

async function fetchCategories() {
  const { data } = await aqlQuery(
    q('categories')
      .filter({ hidden: false })
      .select(['id', 'name', { groupName: 'group.name' }]),
  );
  return data as Array<{ id: string; name: string; groupName: string | null }>;
}

async function fetchHistory() {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ category: { $ne: null }, transfer_id: null })
      .select([{ payeeName: 'payee.name' }, { categoryName: 'category.name' }])
      .orderBy({ date: 'desc' })
      .limit(HISTORY_LIMIT),
  );
  return (
    data as Array<{ payeeName: string | null; categoryName: string | null }>
  )
    .filter(row => row.payeeName && row.categoryName)
    .map(row => ({
      payeeName: row.payeeName as string,
      categoryName: row.categoryName as string,
    }));
}

function confidenceStatus(
  confidence: number,
  threshold: number,
): 'auto_applied' | 'pending' | 'skip' {
  if (confidence >= threshold) return 'auto_applied';
  if (confidence >= threshold / 2) return 'pending';
  return 'skip';
}

type BatchResult =
  | { status: 'ok'; autoApplied: number; pendingReview: number }
  | { status: 'run-failed' };

async function classifyBatch(
  pending: PendingTransaction[],
  categories: Array<{ id: string; name: string; groupName: string | null }>,
  config: ReturnType<typeof getAiConfig>,
): Promise<BatchResult> {
  const cacheHits = new Map<string, string | null>();
  const toClassify: PendingTransaction[] = [];
  for (const t of pending) {
    const key = buildCacheKey({
      account: t.account,
      payeeName: t.payeeName ?? '',
      amountCents: t.amount,
    });
    const cached = responseCache.get(key);
    if (cached) {
      cacheHits.set(t.id, cached.value);
    } else {
      toClassify.push(t);
    }
  }

  let output: ClassifierOutput | null = null;
  let runId: string | undefined;
  if (toClassify.length > 0) {
    const history = await fetchHistory();
    const providerConfig = await buildProviderConfigForTier(
      classifierAgent.tier,
    );

    const candidates: ClassifierCandidate[] = toClassify.map(t => ({
      id: t.id,
      payeeName: config.redactPii
        ? redactPii(t.payeeName ?? '')
        : (t.payeeName ?? ''),
      amountCents: t.amount,
      date: t.date,
      notes: t.notes
        ? config.redactPii
          ? redactPii(t.notes)
          : t.notes
        : undefined,
    }));

    try {
      const result = await runWorkflow(
        classifierAgent,
        {
          categories: categories.map(c => ({
            id: c.id,
            name: c.name,
            group: c.groupName ?? undefined,
          })),
          history,
          transactions: candidates,
        },
        { config: providerConfig },
      );
      runId = await recordRun(result.run);
      output = result.output;
    } catch (error) {
      if (error instanceof WorkflowError) {
        await recordRun(error.run);
      }
      logger.warn('AI classification run failed:', error);
      return { status: 'run-failed' };
    }
  }

  const byId = new Map<string, PendingTransaction>(pending.map(t => [t.id, t]));

  let autoApplied = 0;
  let pendingReview = 0;

  for (const [transactionId, categoryId] of cacheHits) {
    const transaction = byId.get(transactionId);
    if (!transaction) continue;
    const applied = await applySuggestion({
      transactionId,
      categoryId,
      confidence: 1,
      rationale: 'Matched a prior classification for this payee/amount.',
      threshold: config.confidenceThreshold,
    });
    if (applied === 'auto_applied') autoApplied++;
    else if (applied === 'pending') pendingReview++;
  }

  if (output) {
    for (const item of output.items) {
      const key = buildCacheKey({
        account: byId.get(item.id)?.account ?? '',
        payeeName: byId.get(item.id)?.payeeName ?? '',
        amountCents: byId.get(item.id)?.amount ?? 0,
      });
      responseCache.set(key, {
        value: item.categoryId,
        cachedAt: new Date().toISOString(),
      });

      const applied = await applySuggestion({
        transactionId: item.id,
        categoryId: item.categoryId,
        confidence: item.confidence,
        rationale: item.rationale,
        threshold: config.confidenceThreshold,
        runId,
      });
      if (applied === 'auto_applied') autoApplied++;
      else if (applied === 'pending') pendingReview++;
    }
  }

  return { status: 'ok', autoApplied, pendingReview };
}

/** Shared by both entry points below: reports the total up front (before a
 * single LLM call), then works through it in BATCH_SIZE chunks, re-checking
 * the $/day budget between chunks so a large backlog degrades gracefully
 * instead of either ignoring the budget or failing the whole pass. */
async function runClassificationPass(
  eventAccountId: string | undefined,
  allPending: PendingTransaction[],
  config: ReturnType<typeof getAiConfig>,
): Promise<ClassifyOutcome> {
  if (allPending.length === 0) return { status: 'no-pending' };

  connection.send('ai-classification-started', {
    accountId: eventAccountId,
    count: allPending.length,
  });

  const categories = await fetchCategories();

  let autoApplied = 0;
  let pendingReview = 0;
  let processedAnyBatch = false;

  for (let i = 0; i < allPending.length; i += BATCH_SIZE) {
    try {
      assertCanStartRun(
        { maxCostPerDayUsd: config.maxCostPerDayUsd },
        await getSpendTodayUsd(),
      );
    } catch (error) {
      logger.warn('AI classification stopped (budget):', error);
      if (!processedAnyBatch) return { status: 'budget-exceeded' };
      break;
    }

    const batch = allPending.slice(i, i + BATCH_SIZE);
    const result = await classifyBatch(batch, categories, config);
    if (result.status === 'run-failed') {
      if (!processedAnyBatch) return { status: 'run-failed' };
      break;
    }

    autoApplied += result.autoApplied;
    pendingReview += result.pendingReview;
    processedAnyBatch = true;
  }

  if (autoApplied > 0 || pendingReview > 0) {
    connection.send('ai-classification-event', {
      accountId: eventAccountId,
      autoApplied,
      pendingReview,
    });
    connection.send('sync-event', {
      type: 'success',
      tables: ['transactions'],
    });
  }

  return { status: 'ok', autoApplied, pendingReview };
}

/** Runs after a bank sync: classifies this account's uncategorized,
 * non-transfer transactions. Fetches the whole backlog up front (capped at
 * MAX_TRANSACTIONS_PER_RUN) so the caller can report the real total right
 * away, then works through it in batches instead of only ever touching the
 * first one. Best-effort by design — mirrors the Pluggy-bills post-sync
 * hook in accounts/sync.ts, which must never fail an otherwise-successful
 * transaction sync. */
export async function classifyPendingTransactions(
  accountId: string,
): Promise<ClassifyOutcome> {
  const config = getAiConfig();
  if (!config.enabled) return { status: 'disabled' };

  const allPending = await fetchPendingTransactions(
    accountId,
    MAX_TRANSACTIONS_PER_RUN,
  );
  return runClassificationPass(accountId, allPending, config);
}

/** Manual trigger from the Uncategorized screen: classifies exactly the
 * given (still-uncategorized) transactions, regardless of which account
 * they're on — used for both "classify everything visible" and "classify
 * just what I selected". Unlike the post-sync hook this is user-initiated,
 * so it isn't best-effort: callers see failures directly. */
export async function classifyTransactionsById(
  transactionIds: string[],
): Promise<ClassifyOutcome> {
  const config = getAiConfig();
  if (!config.enabled) return { status: 'disabled' };
  if (transactionIds.length === 0) return { status: 'no-pending' };

  const allPending = await fetchTransactionsByIds(
    transactionIds.slice(0, MAX_TRANSACTIONS_PER_RUN),
  );
  return runClassificationPass(undefined, allPending, config);
}

async function applySuggestion(params: {
  transactionId: string;
  categoryId: string | null;
  confidence: number;
  rationale: string;
  threshold: number;
  runId?: string;
}): Promise<'auto_applied' | 'pending' | 'skip'> {
  if (!params.categoryId) return 'skip';

  const status = confidenceStatus(params.confidence, params.threshold);
  if (status === 'skip') return 'skip';

  await createSuggestion({
    transactionId: params.transactionId,
    categoryId: params.categoryId,
    confidence: params.confidence,
    rationale: params.rationale,
    status,
    runId: params.runId,
  });

  if (status === 'auto_applied') {
    await batchUpdateTransactions({
      updated: [{ id: params.transactionId, category: params.categoryId }],
    });
  }

  return status;
}
