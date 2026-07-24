import type * as AiCore from '@actual-app/ai';
import type { ClassifierOutput, WorkflowResult } from '@actual-app/ai';

import * as connection from '#platform/server/connection';
import * as db from '#server/db';

import { classifyPendingTransactions } from './classify';
import { DEFAULT_AI_CONFIG, setAiConfig } from './config';
import { getPendingSuggestions } from './suggestions';

const runWorkflowMock = vi.fn();

vi.mock('@actual-app/ai', async () => {
  const actual = await vi.importActual<typeof AiCore>('@actual-app/ai');
  return {
    ...actual,
    runWorkflow: (...args: unknown[]) => runWorkflowMock(...args),
  };
});

beforeEach(() => {
  runWorkflowMock.mockReset();
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

function mockWorkflowOutput(output: ClassifierOutput) {
  runWorkflowMock.mockResolvedValue({
    output,
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
});
