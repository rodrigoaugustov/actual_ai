import type * as AiCore from '@actual-app/ai';
import type { RuleMinerOutput, WorkflowResult } from '@actual-app/ai';

import * as db from '#server/db';

import { DEFAULT_AI_CONFIG, setAiConfig } from './config';
import { getRuleProposals } from './rule-meta';
import { mineRuleProposals } from './rule-miner';

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

async function prepareCategorizedHistory() {
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

  it('creates a proposal from the mined output, linked to sample transaction ids', async () => {
    await prepareCategorizedHistory();
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
      status: 'proposed',
    });
    expect(proposals[0].sampleTransactionIds.length).toBeGreaterThan(0);
  });
});
