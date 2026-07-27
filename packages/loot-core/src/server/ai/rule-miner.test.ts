import type * as AiCore from '@actual-app/ai';
import type { RuleMinerOutput, WorkflowResult } from '@actual-app/ai';

import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { insertRule, loadRules } from '#server/transactions/transaction-rules';

import { DEFAULT_AI_CONFIG, setAiConfig } from './config';
import {
  createRuleProposal,
  getRuleProposals,
  resolveRuleProposal,
} from './rule-meta';
import { maybeMineRuleProposals, mineRuleProposals } from './rule-miner';

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

async function prepareCategorizedHistory(): Promise<string> {
  await db.insertAccount({ id: 'checking', name: 'checking' });
  await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'group1',
  });
  const payeeId = await db.insertPayee({ name: 'Extra' });
  for (let i = 0; i < 3; i++) {
    await db.insertTransaction({
      id: `txn${i}`,
      account: 'checking',
      payee: payeeId,
      category: 'groceries',
      imported_payee: `EXTRA SUPERMERCADOS ${i}`,
      amount: -1000 * (i + 1),
      date: `2026-01-0${i + 1}`,
    });
  }
  return payeeId;
}

/** Gives a transaction the human/AI paper trail `fetchCandidateGroups` now
 * requires as evidence — without it, a directly-inserted categorized
 * transaction no longer counts as "user history" (see rule-miner.ts). */
async function insertManualFeedback(
  transactionId: string,
  categoryId: string,
  offsetMs = 0,
) {
  await db.insertWithUUID('ai_feedback', {
    transaction_id: transactionId,
    account_id: 'checking',
    payee_name: 'Extra',
    normalized_payee: 'extra',
    amount: -1000,
    suggested_category_id: null,
    final_category_id: categoryId,
    source: 'manual',
    suggestion_id: null,
    run_id: null,
    created_at: Date.now() + offsetMs,
    tombstone: 0,
  });
}

function mockWorkflowOutput(output: RuleMinerOutput) {
  runWorkflowMock.mockResolvedValue({
    output,
    run: {
      agent: 'rule-miner',
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
  } satisfies WorkflowResult<RuleMinerOutput>);
}

describe('mineRuleProposals', () => {
  it('is a no-op when AI is disabled', async () => {
    await prepareCategorizedHistory();
    const outcome = await mineRuleProposals();
    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'disabled' });
  });

  it('is a no-op when there are fewer than 3 samples for every payee', async () => {
    await db.insertAccount({ id: 'checking', name: 'checking' });
    await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
    await db.insertCategory({
      id: 'groceries',
      name: 'Groceries',
      cat_group: 'group1',
    });
    const payeeId = await db.insertPayee({ name: 'Rare' });
    await db.insertTransaction({
      id: 'txn-rare',
      account: 'checking',
      payee: payeeId,
      category: 'groceries',
      imported_payee: 'RARE PAYEE',
      amount: -500,
      date: '2026-01-01',
    });
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });

    const outcome = await mineRuleProposals();

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'no-candidates' });
  });

  it('is a no-op when the categorized history has no evidence trail (pure rule classification)', async () => {
    // Transactions categorized only by a rule (no ai_feedback / ai_suggestions
    // row) must not count as "user history" — otherwise an approved rule
    // becomes its own justification for reproposing itself.
    await prepareCategorizedHistory();
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });

    const outcome = await mineRuleProposals();

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'no-candidates' });
  });

  it('starts continuous mining only after five new human decisions', async () => {
    await prepareCategorizedHistory();
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockWorkflowOutput({ proposals: [] });

    for (let index = 0; index < 4; index++) {
      await insertManualFeedback(`txn${index % 3}`, 'groceries', index);
    }

    expect(await maybeMineRuleProposals()).toBeNull();
    expect(runWorkflowMock).not.toHaveBeenCalled();

    await insertManualFeedback('txn1', 'groceries', 10);

    expect(await maybeMineRuleProposals()).toEqual({
      status: 'ok',
      proposalsCreated: 0,
    });
    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('creates a proposal from the mined output, linked to sample transaction ids', async () => {
    await prepareCategorizedHistory();
    for (let i = 0; i < 3; i++) {
      await insertManualFeedback(`txn${i}`, 'groceries', i);
    }
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockWorkflowOutput({
      proposals: [
        {
          payeeName: 'Extra',
          op: 'contains',
          value: 'EXTRA',
          categoryId: 'groceries',
          rationale: 'Consistent across 3 samples',
          confidence: 0.9,
        },
      ],
    });

    const outcome = await mineRuleProposals();

    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ status: 'ok', proposalsCreated: 1 });
    const proposals = await getRuleProposals();
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      payeeName: 'Extra',
      op: 'contains',
      value: 'EXTRA',
      categoryId: 'groceries',
      confidence: 0.9,
      status: 'proposed',
    });
    expect(proposals[0].sampleTransactionIds.length).toBeGreaterThan(0);
  });

  it('drops a proposal below the minimum confidence instead of showing it to the user', async () => {
    await prepareCategorizedHistory();
    for (let i = 0; i < 3; i++) {
      await insertManualFeedback(`txn${i}`, 'groceries', i);
    }
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockWorkflowOutput({
      proposals: [
        {
          payeeName: 'Extra',
          op: 'contains',
          value: 'EXTRA',
          categoryId: 'groceries',
          rationale: 'Not very sure',
          confidence: 0.2,
        },
      ],
    });

    const outcome = await mineRuleProposals();

    expect(outcome).toEqual({ status: 'ok', proposalsCreated: 0 });
    expect(await getRuleProposals()).toHaveLength(0);
  });

  it('does not repropose a payee that already has a pending proposal awaiting review', async () => {
    await prepareCategorizedHistory();
    for (let i = 0; i < 3; i++) {
      await insertManualFeedback(`txn${i}`, 'groceries', i);
    }
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    await createRuleProposal({
      proposal: {
        payeeName: 'Extra',
        op: 'contains',
        value: 'EXTRA',
        categoryId: 'groceries',
        rationale: 'x',
        confidence: 0.9,
      },
      sampleTransactionIds: [],
    });

    const outcome = await mineRuleProposals();

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'no-candidates' });
  });

  it('drops a proposal that repeats an exact payee/category pair the user already rejected', async () => {
    await prepareCategorizedHistory();
    for (let i = 0; i < 3; i++) {
      await insertManualFeedback(`txn${i}`, 'groceries', i);
    }
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    const rejectedId = await createRuleProposal({
      proposal: {
        payeeName: 'Extra',
        op: 'contains',
        value: 'EXTRA',
        categoryId: 'groceries',
        rationale: 'x',
        confidence: 0.9,
      },
      sampleTransactionIds: [],
    });
    await resolveRuleProposal({ id: rejectedId, action: 'reject' });
    mockWorkflowOutput({
      proposals: [
        {
          payeeName: 'Extra',
          op: 'contains',
          value: 'EXTRA',
          categoryId: 'groceries',
          rationale: 'same pair proposed again',
          confidence: 0.9,
        },
      ],
    });

    const outcome = await mineRuleProposals();

    // The model was still called (a single rejection isn't enough to drop
    // the payee as a candidate entirely — only the exact rejected pair is
    // hard-blocked once it comes back in the response).
    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ status: 'ok', proposalsCreated: 0 });
    expect(await getRuleProposals()).toHaveLength(0);
  });

  it('stops proposing a payee entirely after two rejections, regardless of category', async () => {
    await prepareCategorizedHistory();
    for (let i = 0; i < 3; i++) {
      await insertManualFeedback(`txn${i}`, 'groceries', i);
    }
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    for (let i = 0; i < 2; i++) {
      const id = await createRuleProposal({
        proposal: {
          payeeName: 'Extra',
          op: 'contains',
          value: 'EXTRA',
          categoryId: 'groceries',
          rationale: 'x',
          confidence: 0.9,
        },
        sampleTransactionIds: [],
      });
      await resolveRuleProposal({ id, action: 'reject' });
    }

    const outcome = await mineRuleProposals();

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'no-candidates' });
  });

  it('does not propose a rule for a payee already covered by an existing rule keyed on the resolved payee ("beneficiário" in the UI)', async () => {
    // Reproduces the reported bug: a manual rule already exists for this
    // payee via the resolved payee (the "Payee" field in the rule builder),
    // so the miner must not propose a second, redundant rule keyed on the
    // raw imported description — which is always what the miner itself uses.
    const payeeId = await prepareCategorizedHistory();
    for (let i = 0; i < 3; i++) {
      await insertManualFeedback(`txn${i}`, 'groceries', i);
    }
    await loadMappings();
    await loadRules();
    await insertRule({
      stage: null,
      conditionsOp: 'and',
      conditions: [{ field: 'payee', op: 'is', value: payeeId, type: 'id' }],
      actions: [{ field: 'category', op: 'set', value: 'groceries' }],
    });
    await loadRules();
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });

    const outcome = await mineRuleProposals();

    expect(runWorkflowMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'no-candidates' });
  });
});
