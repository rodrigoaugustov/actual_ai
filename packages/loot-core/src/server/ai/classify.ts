import {
  assertCanStartRun,
  buildCacheKey,
  classifierAgent,
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

import { getCategoryDescriptions } from './category-profiles';
import {
  buildMerchantClusterId,
  getRelevantClassifierEvidence,
} from './classifier-context';
import { getAiConfig } from './config';
import {
  getFeedbackExamples,
  getLearnedCategories,
  getRejectedExamples,
} from './feedback';
import { buildProviderConfigForTier } from './fetch-client';
import { researchMerchant } from './merchant-enrichment';
import { getSpendTodayUsd, recordRun } from './runs';
import { createSuggestion } from './suggestions';

const BATCH_SIZE = 50;
// Safety cap across the whole run, independent of the $/day budget: without
// it, a first sync of an account with years of history would keep looping
// (and spending) until assertCanStartRun finally trips. One pass can always
// pick up wherever this leaves off on the next run.
const MAX_TRANSACTIONS_PER_RUN = 500;
const HISTORY_LIMIT = 30;

type PendingTransaction = {
  id: string;
  account: string;
  amount: number;
  date: string;
  notes: string | null;
  payeeName: string | null;
  importedPayee: string | null;
};

const PENDING_TRANSACTION_FIELDS = [
  'id',
  'account',
  'amount',
  'date',
  'notes',
  { payeeName: 'payee.name' },
  { importedPayee: 'imported_payee' },
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
  const [{ data }, descriptions] = await Promise.all([
    aqlQuery(
      q('categories')
        .filter({ hidden: false })
        .select([
          'id',
          'name',
          'sort_order',
          { groupName: 'group.name' },
          { groupSortOrder: 'group.sort_order' },
        ]),
    ),
    getCategoryDescriptions(),
  ]);
  return (
    data as Array<{
      id: string;
      name: string;
      sort_order: number | null;
      groupName: string | null;
      groupSortOrder: number | null;
    }>
  )
    .sort(
      (left, right) =>
        (left.groupSortOrder ?? 0) - (right.groupSortOrder ?? 0) ||
        (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
        left.id.localeCompare(right.id),
    )
    .map(category => ({
      id: category.id,
      name: category.name,
      groupName: category.groupName,
      description: descriptions.get(category.id),
    }));
}

async function fetchHistory() {
  const feedback = await getFeedbackExamples(HISTORY_LIMIT);
  if (feedback.length >= HISTORY_LIMIT) return feedback;

  const { data } = await aqlQuery(
    q('transactions')
      .filter({ category: { $ne: null }, transfer_id: null })
      .select([{ payeeName: 'payee.name' }, { categoryName: 'category.name' }])
      .orderBy({ date: 'desc' })
      .limit(HISTORY_LIMIT - feedback.length),
  );
  const history = (
    data as Array<{ payeeName: string | null; categoryName: string | null }>
  )
    .filter(row => row.payeeName && row.categoryName)
    .map(row => ({
      payeeName: row.payeeName as string,
      categoryName: row.categoryName as string,
    }));
  return feedback.concat(history);
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
  categories: Array<{
    id: string;
    name: string;
    groupName: string | null;
    description?: string;
  }>,
  config: ReturnType<typeof getAiConfig>,
  learnedCategories: Awaited<ReturnType<typeof getLearnedCategories>>,
): Promise<BatchResult> {
  const learnedHits = new Map<string, string>();
  const toClassify: PendingTransaction[] = [];
  for (const t of pending) {
    const key = buildCacheKey({
      account: t.account,
      payeeName: t.payeeName ?? '',
      amountCents: t.amount,
    });
    const learned = learnedCategories.get(key);
    if (learned) {
      learnedHits.set(t.id, learned.categoryId);
    } else {
      toClassify.push(t);
    }
  }

  let output: ClassifierOutput | null = null;
  let runId: string | undefined;
  const runIdsByTransaction = new Map<string, string>();
  if (toClassify.length > 0) {
    const history = (await fetchHistory()).map(item => ({
      ...item,
      payeeName: config.redactPii ? redactPii(item.payeeName) : item.payeeName,
    }));
    const rejections = (await getRejectedExamples(HISTORY_LIMIT)).map(item => ({
      ...item,
      payeeName: config.redactPii ? redactPii(item.payeeName) : item.payeeName,
    }));
    const evidence = (
      await getRelevantClassifierEvidence(
        toClassify,
        config.confidenceThreshold,
      )
    ).map(item => ({
      ...item,
      payeeName: config.redactPii ? redactPii(item.payeeName) : item.payeeName,
      importedPayee:
        config.redactPii && item.importedPayee
          ? redactPii(item.importedPayee)
          : item.importedPayee,
    }));
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
      importedPayee: t.importedPayee
        ? config.redactPii
          ? redactPii(t.importedPayee)
          : t.importedPayee
        : undefined,
      notes: t.notes
        ? config.redactPii
          ? redactPii(t.notes)
          : t.notes
        : undefined,
      merchantClusterId: buildMerchantClusterId(t),
    }));

    try {
      const result = await runWorkflow(
        classifierAgent,
        {
          categories: categories.map(c => ({
            id: c.id,
            name: c.name,
            group: c.groupName ?? undefined,
            description: c.description,
          })),
          history,
          rejections,
          evidence,
          transactions: candidates,
        },
        { config: providerConfig },
      );
      runId = await recordRun(result.run);
      for (const candidate of candidates) {
        runIdsByTransaction.set(candidate.id, runId);
      }
      output = validateAndReconcileOutput(
        result.output,
        candidates,
        categories,
        config.confidenceThreshold,
      );
      if (config.webSearchEnabled) {
        const researchClusterIds = [
          ...new Set(
            output.items
              .filter(
                item =>
                  item.needsWebResearch ||
                  item.categoryId == null ||
                  item.confidence < config.confidenceThreshold,
              )
              .map(item =>
                candidates.find(candidate => candidate.id === item.id),
              )
              .flatMap(candidate =>
                candidate?.merchantClusterId
                  ? [candidate.merchantClusterId]
                  : [],
              ),
          ),
        ].slice(
          0,
          Math.min(Math.max(config.maxWebSearchesPerBatch ?? 3, 0), 5),
        );
        const research = (
          await Promise.all(
            researchClusterIds.map(async merchantClusterId => {
              const candidate = candidates.find(
                item => item.merchantClusterId === merchantClusterId,
              );
              if (!candidate) return null;
              const query = redactPii(
                [
                  candidate.payeeName,
                  candidate.importedPayee,
                  candidate.notes?.slice(0, 120),
                  'empresa estabelecimento Brasil',
                ]
                  .filter(Boolean)
                  .join(' '),
              ).slice(0, 200);
              try {
                return await researchMerchant({
                  merchantClusterId,
                  query,
                });
              } catch {
                logger.warn(
                  'Optional merchant web research failed; keeping local classification.',
                );
                return null;
              }
            }),
          )
        ).filter(item => item != null);
        if (research.length > 0) {
          const researchedClusters = new Set(
            research.map(item => item.merchantClusterId),
          );
          const researchedCandidates = candidates.filter(candidate =>
            researchedClusters.has(candidate.merchantClusterId ?? ''),
          );
          try {
            assertCanStartRun(
              { maxCostPerDayUsd: config.maxCostPerDayUsd },
              await getSpendTodayUsd(),
            );
            const researchedResult = await runWorkflow(
              classifierAgent,
              {
                categories: categories.map(c => ({
                  id: c.id,
                  name: c.name,
                  group: c.groupName ?? undefined,
                  description: c.description,
                })),
                history,
                rejections,
                evidence: evidence.filter(item =>
                  researchedClusters.has(item.merchantClusterId),
                ),
                research,
                transactions: researchedCandidates,
              },
              { config: providerConfig },
            );
            const researchedRunId = await recordRun(researchedResult.run);
            const researchedOutput = validateAndReconcileOutput(
              researchedResult.output,
              researchedCandidates,
              categories,
              config.confidenceThreshold,
            );
            const replacementIds = new Set(
              researchedOutput.items.map(item => item.id),
            );
            output = {
              items: output.items
                .filter(item => !replacementIds.has(item.id))
                .concat(researchedOutput.items),
            };
            for (const item of researchedOutput.items) {
              runIdsByTransaction.set(item.id, researchedRunId);
            }
          } catch (error) {
            if (error instanceof WorkflowError) {
              await recordRun(error.run);
            }
            logger.warn(
              'Optional researched classification failed; keeping local classification.',
            );
          }
        }
      }
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

  for (const [transactionId, categoryId] of learnedHits) {
    const transaction = byId.get(transactionId);
    if (!transaction) continue;
    const applied = await applySuggestion({
      transactionId,
      categoryId,
      confidence: 1,
      rationale:
        'Matched repeated user-confirmed classifications for this payee and amount range.',
      threshold: config.confidenceThreshold,
    });
    if (applied === 'auto_applied') autoApplied++;
    else if (applied === 'pending') pendingReview++;
  }

  if (output) {
    for (const item of output.items) {
      const applied = await applySuggestion({
        transactionId: item.id,
        categoryId: item.categoryId,
        confidence: item.confidence,
        rationale: item.rationale,
        threshold: config.confidenceThreshold,
        runId: runIdsByTransaction.get(item.id) ?? runId,
      });
      if (applied === 'auto_applied') autoApplied++;
      else if (applied === 'pending') pendingReview++;
    }
  }

  return { status: 'ok', autoApplied, pendingReview };
}

function validateAndReconcileOutput(
  output: ClassifierOutput,
  candidates: ClassifierCandidate[],
  categories: Array<{ id: string }>,
  confidenceThreshold: number,
): ClassifierOutput {
  const candidatesById = new Map(
    candidates.map(candidate => [candidate.id, candidate]),
  );
  const validCategoryIds = new Set(categories.map(category => category.id));
  const uniqueItems = new Map<string, ClassifierOutput['items'][number]>();
  for (const item of output.items) {
    if (!candidatesById.has(item.id)) {
      logger.warn('Ignoring classifier output for an unknown transaction id.');
      continue;
    }
    if (item.categoryId && !validCategoryIds.has(item.categoryId)) {
      logger.warn('Ignoring classifier output with an unknown category id.');
      continue;
    }
    const previous = uniqueItems.get(item.id);
    if (!previous || item.confidence > previous.confidence) {
      uniqueItems.set(item.id, item);
    }
  }

  const itemsByCluster = new Map<
    string,
    Array<ClassifierOutput['items'][number]>
  >();
  for (const item of uniqueItems.values()) {
    const candidate = candidatesById.get(item.id);
    if (!candidate) continue;
    const clusterId = candidate.merchantClusterId ?? candidate.id;
    const cluster = itemsByCluster.get(clusterId) ?? [];
    cluster.push(item);
    itemsByCluster.set(clusterId, cluster);
  }

  for (const cluster of itemsByCluster.values()) {
    const categoriesInCluster = new Map<string, number>();
    for (const item of cluster) {
      if (!item.categoryId) continue;
      categoriesInCluster.set(
        item.categoryId,
        (categoriesInCluster.get(item.categoryId) ?? 0) + item.confidence,
      );
    }
    if (categoriesInCluster.size <= 1) continue;
    const ranked = [...categoriesInCluster].sort(
      (left, right) => right[1] - left[1],
    );
    const [topCategoryId, topScore] = ranked[0] ?? [];
    const secondScore = ranked[1]?.[1] ?? 0;
    if (topCategoryId && topScore >= secondScore * 1.25) {
      for (const item of cluster) {
        if (!item.categoryId || item.categoryId === topCategoryId) continue;
        uniqueItems.set(item.id, {
          ...item,
          categoryId: topCategoryId,
          rationale: `Merchant-cluster consensus: ${item.rationale}`,
        });
      }
    } else {
      for (const item of cluster) {
        uniqueItems.set(item.id, {
          ...item,
          confidence: Math.min(
            item.confidence,
            Math.max(confidenceThreshold / 2, confidenceThreshold - 0.01),
          ),
          rationale: `Conflicting merchant-cluster evidence; human review required. ${item.rationale}`,
        });
      }
    }
  }
  return { items: [...uniqueItems.values()] };
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
  const learnedCategories = await getLearnedCategories();

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
    const result = await classifyBatch(
      batch,
      categories,
      config,
      learnedCategories,
    );
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

/** Re-runs the classifier for a transaction whose rule hit was rejected by
 * the auditor. The existing category is preserved and the alternative is
 * always left for human review. */
export async function classifyTransactionForReview(
  transactionId: string,
): Promise<boolean> {
  const config = getAiConfig();
  if (!config.enabled) return false;

  const { data } = await aqlQuery(
    q('transactions')
      .filter({ id: transactionId, transfer_id: null, is_parent: false })
      .select([...PENDING_TRANSACTION_FIELDS, 'category'])
      .limit(1),
  );
  const transaction = data[0] as
    | (PendingTransaction & { category: string | null })
    | undefined;
  if (!transaction) return false;

  assertCanStartRun(
    { maxCostPerDayUsd: config.maxCostPerDayUsd },
    await getSpendTodayUsd(),
  );

  const categories = await fetchCategories();
  const providerConfig = await buildProviderConfigForTier(classifierAgent.tier);
  const candidate: ClassifierCandidate = {
    id: transaction.id,
    payeeName: config.redactPii
      ? redactPii(transaction.payeeName ?? '')
      : (transaction.payeeName ?? ''),
    amountCents: transaction.amount,
    date: transaction.date,
    importedPayee: transaction.importedPayee
      ? config.redactPii
        ? redactPii(transaction.importedPayee)
        : transaction.importedPayee
      : undefined,
    notes: transaction.notes
      ? config.redactPii
        ? redactPii(transaction.notes)
        : transaction.notes
      : undefined,
    merchantClusterId: buildMerchantClusterId(transaction),
  };
  const result = await runWorkflow(
    classifierAgent,
    {
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        group: category.groupName ?? undefined,
        description: category.description,
      })),
      history: (await fetchHistory()).map(item => ({
        ...item,
        payeeName: config.redactPii
          ? redactPii(item.payeeName)
          : item.payeeName,
      })),
      rejections: (await getRejectedExamples(HISTORY_LIMIT)).map(item => ({
        ...item,
        payeeName: config.redactPii
          ? redactPii(item.payeeName)
          : item.payeeName,
      })),
      evidence: (
        await getRelevantClassifierEvidence(
          [transaction],
          config.confidenceThreshold,
        )
      ).map(item => ({
        ...item,
        payeeName: config.redactPii
          ? redactPii(item.payeeName)
          : item.payeeName,
        importedPayee:
          config.redactPii && item.importedPayee
            ? redactPii(item.importedPayee)
            : item.importedPayee,
      })),
      transactions: [candidate],
    },
    { config: providerConfig },
  );
  const runId = await recordRun(result.run);
  const validatedOutput = validateAndReconcileOutput(
    result.output,
    [candidate],
    categories,
    config.confidenceThreshold,
  );
  const suggestion = validatedOutput.items.find(
    item => item.id === transaction.id,
  );
  if (
    !suggestion?.categoryId ||
    suggestion.categoryId === transaction.category
  ) {
    return false;
  }

  await createSuggestion({
    transactionId: transaction.id,
    categoryId: suggestion.categoryId,
    confidence: suggestion.confidence,
    rationale: `Rule audit requested review: ${suggestion.rationale}`,
    status: 'pending',
    runId,
  });
  return true;
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
