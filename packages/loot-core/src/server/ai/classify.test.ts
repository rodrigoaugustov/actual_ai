import type * as AiCore from '@actual-app/ai';
import type { ClassifierOutput, WorkflowResult } from '@actual-app/ai';

import * as connection from '#platform/server/connection';
import * as db from '#server/db';

import { classifyPendingTransactions } from './classify';
import { DEFAULT_AI_CONFIG, setAiConfig } from './config';
import { recordFeedback } from './feedback';
import { getPendingSuggestions } from './suggestions';

const runWorkflowMock = vi.fn();
const researchMerchantMock = vi.fn();

vi.mock('@actual-app/ai', async () => {
  const actual = await vi.importActual<typeof AiCore>('@actual-app/ai');
  return {
    ...actual,
    runWorkflow: (...args: unknown[]) => runWorkflowMock(...args),
  };
});
vi.mock('./merchant-enrichment', () => ({
  researchMerchant: (...args: unknown[]) => researchMerchantMock(...args),
}));

beforeEach(() => {
  runWorkflowMock.mockReset();
  researchMerchantMock.mockReset();
});
beforeEach(global.emptyDatabase());

async function prepareAccountWithTransaction({
  accountId = 'checking',
  payeeName = 'Extra',
  transactionId = 'txn1',
}: {
  accountId?: string;
  payeeName?: string;
  transactionId?: string;
} = {}) {
  await db.insertAccount({ id: accountId, name: accountId });
  const payeeId = await db.insertPayee({ name: payeeName });
  await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'group1',
  });
  await db.insertTransaction({
    id: transactionId,
    account: accountId,
    payee: payeeId,
    amount: -5000,
    date: '2026-01-05',
  });
  return { accountId, transactionId };
}

type ClassifierTestItem = Omit<
  ClassifierOutput['items'][number],
  'needsWebResearch' | 'researchQuery'
> &
  Partial<
    Pick<
      ClassifierOutput['items'][number],
      'needsWebResearch' | 'researchQuery'
    >
  >;

function mockWorkflowOutput(output: { items: ClassifierTestItem[] }) {
  const normalizedOutput: ClassifierOutput = {
    items: output.items.map(item => ({
      needsWebResearch: false,
      researchQuery: null,
      ...item,
    })),
  };
  runWorkflowMock.mockResolvedValue({
    output: normalizedOutput,
    run: {
      agent: 'classifier',
      tier: 'standard',
      provider: 'anthropic',
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0.001,
      durationMs: 10,
      status: 'ok',
    },
  } satisfies WorkflowResult<ClassifierOutput>);
}

describe('classifyPendingTransactions', () => {
  it('is a no-op when AI is disabled (the default)', async () => {
    const { accountId } = await prepareAccountWithTransaction();
    const outcome = await classifyPendingTransactions(accountId);
    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(await getPendingSuggestions()).toHaveLength(0);
    expect(outcome).toEqual({ status: 'disabled' });
  });

  it('auto-applies a high-confidence suggestion and does not leave it pending', async () => {
    const { accountId, transactionId } = await prepareAccountWithTransaction({
      accountId: 'acct-auto',
      payeeName: 'Auto Payee',
      transactionId: 'txn-auto',
    });
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.8,
    });
    mockWorkflowOutput({
      items: [
        {
          id: transactionId,
          categoryId: 'groceries',
          confidence: 0.95,
          rationale: 'Known grocery payee',
        },
      ],
    });

    const outcome = await classifyPendingTransactions(accountId);

    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    const transaction = await db.first<{ category: string }>(
      'SELECT category FROM transactions WHERE id = ?',
      [transactionId],
    );
    expect(transaction?.category).toBe('groceries');
    expect(await getPendingSuggestions()).toHaveLength(0);
    expect(outcome).toEqual({
      status: 'ok',
      autoApplied: 1,
      pendingReview: 0,
    });
  });

  it('leaves a medium-confidence suggestion pending without applying it', async () => {
    const { accountId, transactionId } = await prepareAccountWithTransaction({
      accountId: 'acct-pending',
      payeeName: 'Pending Payee',
      transactionId: 'txn-pending',
    });
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.8,
    });
    mockWorkflowOutput({
      items: [
        {
          id: transactionId,
          categoryId: 'groceries',
          confidence: 0.5,
          rationale: 'Somewhat likely',
        },
      ],
    });

    const outcome = await classifyPendingTransactions(accountId);

    const transaction = await db.first<{ category: string | null }>(
      'SELECT category FROM transactions WHERE id = ?',
      [transactionId],
    );
    expect(transaction?.category).toBeNull();
    const pending = await getPendingSuggestions();
    expect(pending).toHaveLength(1);
    expect(pending[0].categoryId).toBe('groceries');
    expect(outcome).toEqual({
      status: 'ok',
      autoApplied: 0,
      pendingReview: 1,
    });
  });

  it('does not suggest anything for a low-confidence classification', async () => {
    const { accountId, transactionId } = await prepareAccountWithTransaction({
      accountId: 'acct-low',
      payeeName: 'Low Payee',
      transactionId: 'txn-low',
    });
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.8,
    });
    mockWorkflowOutput({
      items: [
        {
          id: transactionId,
          categoryId: 'groceries',
          confidence: 0.1,
          rationale: 'Unclear',
        },
      ],
    });

    const outcome = await classifyPendingTransactions(accountId);

    expect(await getPendingSuggestions()).toHaveLength(0);
    expect(outcome).toEqual({
      status: 'ok',
      autoApplied: 0,
      pendingReview: 0,
    });
  });

  it('does nothing when there are no uncategorized transactions', async () => {
    await db.insertAccount({ id: 'empty-acct', name: 'empty' });
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });

    const outcome = await classifyPendingTransactions('empty-acct');

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'no-pending' });
  });

  it('reuses repeated user decisions after restart without calling the model', async () => {
    const accountId = 'acct-learned';
    await db.insertAccount({ id: accountId, name: accountId });
    await db.insertPayee({ id: 'market', name: 'Mercado São João' });
    await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
    await db.insertCategory({
      id: 'groceries',
      name: 'Groceries',
      cat_group: 'group1',
    });
    for (const id of ['learned-1', 'learned-2']) {
      await db.insertTransaction({
        id,
        account: accountId,
        payee: 'market',
        category: 'groceries',
        amount: -5000,
        date: '2026-01-05',
      });
      await recordFeedback({
        transactionId: id,
        source: 'manual',
        finalCategoryId: 'groceries',
      });
    }
    await db.insertTransaction({
      id: 'txn-learned',
      account: accountId,
      payee: 'market',
      amount: -5000,
      date: '2026-01-06',
    });
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.8,
    });

    const outcome = await classifyPendingTransactions(accountId);

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(
      await db.first<{ category: string }>(
        'SELECT category FROM transactions WHERE id = ?',
        ['txn-learned'],
      ),
    ).toEqual({ category: 'groceries' });
    expect(outcome).toEqual({
      status: 'ok',
      autoApplied: 1,
      pendingReview: 0,
    });
  });

  it('processes the whole backlog across multiple batches, not just the first 50', async () => {
    const accountId = 'acct-bulk';
    await db.insertAccount({ id: accountId, name: accountId });
    await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
    await db.insertCategory({
      id: 'groceries',
      name: 'Groceries',
      cat_group: 'group1',
    });
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.8,
    });

    const TOTAL = 60;
    for (let i = 0; i < TOTAL; i++) {
      const payeeId = await db.insertPayee({ name: `Bulk Payee ${i}` });
      await db.insertTransaction({
        id: `txn-bulk-${i}`,
        account: accountId,
        payee: payeeId,
        amount: -1000,
        date: '2026-01-05',
      });
    }

    runWorkflowMock.mockImplementation(
      async (
        _agent: unknown,
        input: { transactions: Array<{ id: string }> },
      ) => ({
        output: {
          items: input.transactions.map(t => ({
            id: t.id,
            categoryId: 'groceries',
            confidence: 0.95,
            rationale: 'bulk',
            needsWebResearch: false,
            researchQuery: null,
          })),
        },
        run: {
          agent: 'classifier',
          tier: 'standard',
          provider: 'anthropic',
          model: 'test-model',
          inputTokens: 10,
          outputTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0.001,
          durationMs: 10,
          status: 'ok',
        },
      }),
    );

    const outcome = await classifyPendingTransactions(accountId);

    // BATCH_SIZE is 50, so 60 candidates means two runWorkflow calls.
    expect(runWorkflowMock).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({
      status: 'ok',
      autoApplied: TOTAL,
      pendingReview: 0,
    });
    expect(vi.mocked(connection.send)).toHaveBeenCalledWith(
      'ai-classification-started',
      { accountId, count: TOTAL },
    );
  });

  it('does not auto-apply contradictory categories for the same merchant cluster', async () => {
    await db.insertAccount({ id: 'acct-duo', name: 'Checking' });
    await db.insertCategoryGroup({ id: 'expenses', name: 'Expenses' });
    await db.insertCategory({
      id: 'restaurants',
      name: 'Restaurants',
      cat_group: 'expenses',
    });
    await db.insertCategory({
      id: 'other',
      name: 'Other',
      cat_group: 'expenses',
    });
    await db.insertPayee({ id: 'duo', name: 'DuoGourmet' });
    for (const [index, amount] of [-5000, -7000].entries()) {
      await db.insertTransaction({
        id: `duo-${index}`,
        account: 'acct-duo',
        payee: 'duo',
        imported_payee: `DUOGOURMET ${1000 + index}`,
        amount,
        date: '2026-07-20',
      });
    }
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      confidenceThreshold: 0.8,
    });
    mockWorkflowOutput({
      items: [
        {
          id: 'duo-0',
          categoryId: 'restaurants',
          confidence: 0.95,
          rationale: 'Dining service',
        },
        {
          id: 'duo-1',
          categoryId: 'other',
          confidence: 0.95,
          rationale: 'Unclear merchant',
        },
      ],
    });

    const outcome = await classifyPendingTransactions('acct-duo');

    expect(outcome).toEqual({
      status: 'ok',
      autoApplied: 0,
      pendingReview: 2,
    });
    expect(await getPendingSuggestions()).toHaveLength(2);
    expect(
      await db.all<{ category: string | null }>(
        `SELECT category FROM transactions WHERE id LIKE 'duo-%'`,
      ),
    ).toEqual([{ category: null }, { category: null }]);
  });

  it('ignores invented transaction and category ids', async () => {
    const { accountId, transactionId } = await prepareAccountWithTransaction({
      accountId: 'acct-guarded',
      transactionId: 'guarded',
    });
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockWorkflowOutput({
      items: [
        {
          id: transactionId,
          categoryId: 'invented-category',
          confidence: 1,
          rationale: 'Invented',
        },
        {
          id: 'invented-transaction',
          categoryId: 'groceries',
          confidence: 1,
          rationale: 'Invented',
        },
      ],
    });

    expect(await classifyPendingTransactions(accountId)).toEqual({
      status: 'ok',
      autoApplied: 0,
      pendingReview: 0,
    });
    expect(await getPendingSuggestions()).toEqual([]);
  });

  it('researches only ambiguous clusters and reclassifies them with web context', async () => {
    const { accountId, transactionId } = await prepareAccountWithTransaction({
      accountId: 'acct-research',
      payeeName: 'Unknown Duo',
      transactionId: 'research-me',
    });
    await setAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      webSearchEnabled: true,
      maxWebSearchesPerBatch: 1,
    });
    researchMerchantMock.mockResolvedValue({
      merchantClusterId: 'payee:unknownduo',
      query: 'Unknown Duo empresa estabelecimento Brasil',
      summary: 'A supermarket.',
      sources: [
        {
          title: 'Unknown Duo',
          url: 'https://example.com',
          snippet: 'A supermarket chain.',
        },
      ],
    });
    runWorkflowMock
      .mockResolvedValueOnce({
        output: {
          items: [
            {
              id: transactionId,
              categoryId: null,
              confidence: 0.1,
              rationale: 'Merchant is unclear',
              needsWebResearch: true,
              researchQuery: 'Unknown Duo',
            },
          ],
        },
        run: {
          agent: 'classifier',
          tier: 'standard',
          provider: 'anthropic',
          model: 'test-model',
          inputTokens: 10,
          outputTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0.001,
          durationMs: 10,
          status: 'ok',
        },
      })
      .mockResolvedValueOnce({
        output: {
          items: [
            {
              id: transactionId,
              categoryId: 'groceries',
              confidence: 0.95,
              rationale: 'Web evidence identifies a supermarket',
              needsWebResearch: false,
              researchQuery: null,
            },
          ],
        },
        run: {
          agent: 'classifier',
          tier: 'standard',
          provider: 'anthropic',
          model: 'test-model',
          inputTokens: 10,
          outputTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0.001,
          durationMs: 10,
          status: 'ok',
        },
      });

    expect(await classifyPendingTransactions(accountId)).toEqual({
      status: 'ok',
      autoApplied: 1,
      pendingReview: 0,
    });
    expect(researchMerchantMock).toHaveBeenCalledTimes(1);
    expect(runWorkflowMock).toHaveBeenCalledTimes(2);
    expect(runWorkflowMock.mock.calls[1]?.[1]).toMatchObject({
      research: [{ merchantClusterId: 'payee:unknownduo' }],
    });
  });
});
