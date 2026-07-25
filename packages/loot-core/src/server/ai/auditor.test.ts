import type * as AiCore from '@actual-app/ai';
import type {
  AuditorOutput,
  ClassifierOutput,
  RunRecord,
  WorkflowResult,
} from '@actual-app/ai';

import * as db from '#server/db';

import {
  auditApprovedRules,
  computeSampleRate,
  matchesRuleCondition,
} from './auditor';
import { DEFAULT_AI_CONFIG, setAiConfig } from './config';
import { recordRuleHit } from './rule-hits';
import {
  createRuleProposal,
  getRuleHealth,
  resolveRuleProposal,
} from './rule-meta';
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

describe('computeSampleRate', () => {
  it('audits every hit for a new rule (fewer than 5 hits so far)', () => {
    expect(computeSampleRate(0, 0)).toBe(1);
    expect(computeSampleRate(4, 4)).toBe(1);
  });

  it('decays the sample rate as observed precision climbs', () => {
    expect(computeSampleRate(100, 99)).toBe(0.02);
    expect(computeSampleRate(100, 92)).toBe(0.05);
    expect(computeSampleRate(100, 80)).toBe(0.2);
    expect(computeSampleRate(100, 50)).toBe(0.5);
  });
});

describe('matchesRuleCondition', () => {
  it('contains is case-insensitive', () => {
    expect(
      matchesRuleCondition('contains', 'extra', 'EXTRA SUPERMERCADOS'),
    ).toBe(true);
    expect(matchesRuleCondition('contains', 'extra', 'Uber Trip')).toBe(false);
  });

  it('matches applies the value as a case-insensitive regex', () => {
    expect(matchesRuleCondition('matches', '^UBER', 'uber *trip 123')).toBe(
      true,
    );
  });

  it('oneOf matches an exact (case-insensitive) value from the comma list', () => {
    expect(
      matchesRuleCondition('oneOf', 'UBER *TRIP, UBER *EATS', 'uber *eats'),
    ).toBe(true);
    expect(matchesRuleCondition('oneOf', 'UBER *TRIP', 'uber *eats')).toBe(
      false,
    );
  });

  it('never matches a null description', () => {
    expect(matchesRuleCondition('contains', 'extra', null)).toBe(false);
  });
});

function workflowRun(agent: string): RunRecord {
  return {
    agent,
    tier: 'fast',
    provider: 'anthropic',
    model: 'test-model',
    inputTokens: 5,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.0001,
    durationMs: 5,
    status: 'ok' as const,
  };
}

function mockVerdict(verdict: AuditorOutput['verdict']) {
  runWorkflowMock.mockResolvedValue({
    output: { verdict, rationale: 'x' },
    run: workflowRun('auditor'),
  } satisfies WorkflowResult<AuditorOutput>);
}

async function prepareApprovedRule(): Promise<string> {
  await db.insertAccount({ id: 'checking', name: 'checking' });
  await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'group1',
  });
  const payeeId = await db.insertPayee({ name: 'Extra' });
  await db.insertTransaction({
    id: 'txn1',
    account: 'checking',
    payee: payeeId,
    category: 'groceries',
    imported_payee: 'EXTRA SUPERMERCADOS 042',
    amount: -1000,
    date: '2026-01-05',
  });

  const proposalId = await createRuleProposal({
    proposal: {
      payeeName: 'Extra',
      op: 'contains',
      value: 'EXTRA',
      categoryId: 'groceries',
      rationale: 'Consistent history',
      confidence: 0.9,
    },
    sampleTransactionIds: ['txn1'],
  });
  await resolveRuleProposal({ id: proposalId, action: 'approve' });
  const [rule] = await getRuleHealth();
  if (!rule.ruleId) {
    throw new Error('Expected the approved proposal to create a rule');
  }
  return rule.ruleId;
}

describe('auditApprovedRules', () => {
  it('is a no-op when AI is disabled', async () => {
    await prepareApprovedRule();
    await expect(auditApprovedRules()).resolves.toEqual({
      status: 'disabled',
    });
    expect(runWorkflowMock).not.toHaveBeenCalled();
  });

  it('audits an approved proposal sample and increments confirmed hits', async () => {
    await prepareApprovedRule();
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockVerdict('correct');

    await expect(auditApprovedRules()).resolves.toEqual({
      status: 'ok',
      audited: 1,
      confirmed: 1,
      corrected: 0,
      skipped: 0,
      failed: 0,
    });

    const health = await getRuleHealth();
    expect(health).toHaveLength(1);
    expect(health[0]).toMatchObject({ hits: 1, confirmed: 1, corrected: 0 });
  });

  it('increments corrected and hits when the auditor disagrees', async () => {
    await prepareApprovedRule();
    await db.insertCategory({
      id: 'restaurants',
      name: 'Restaurants',
      cat_group: 'group1',
    });
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    runWorkflowMock
      .mockResolvedValueOnce({
        output: { verdict: 'incorrect', rationale: 'x' },
        run: workflowRun('auditor'),
      } satisfies WorkflowResult<AuditorOutput>)
      .mockResolvedValueOnce({
        output: {
          items: [
            {
              id: 'txn1',
              categoryId: 'restaurants',
              confidence: 0.8,
              rationale: 'Looks like a restaurant',
            },
          ],
        },
        run: workflowRun('classifier'),
      } satisfies WorkflowResult<ClassifierOutput>);

    await expect(auditApprovedRules()).resolves.toEqual({
      status: 'ok',
      audited: 1,
      confirmed: 0,
      corrected: 1,
      skipped: 0,
      failed: 0,
    });

    const health = await getRuleHealth();
    expect(health[0]).toMatchObject({ hits: 1, confirmed: 0, corrected: 1 });
    expect(health[0].recentFalsePositives).toMatchObject([
      {
        transactionId: 'txn1',
        payeeName: 'Extra',
        rationale: 'x',
      },
    ]);
    expect(await getPendingSuggestions()).toMatchObject([
      {
        transactionId: 'txn1',
        categoryId: 'restaurants',
        status: 'pending',
      },
    ]);
  });

  it('marks mature-rule hits outside the sample so they are not audited later', async () => {
    const ruleId = await prepareApprovedRule();
    const [rule] = await getRuleHealth();
    await db.update('ai_rule_meta', {
      id: rule.id,
      hits: 100,
      confirmed: 99,
    });
    for (let index = 1; index <= 10; index++) {
      const transactionId = `sample-${index}`;
      await db.insertTransaction({
        id: transactionId,
        account: 'checking',
        category: 'groceries',
        amount: -1000,
        date: '2026-01-05',
      });
      await recordRuleHit({
        ruleId,
        transactionId,
        categoryId: 'groceries',
      });
    }
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockVerdict('correct');

    await auditApprovedRules();

    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
    expect(
      await db.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM ai_rule_hits
          WHERE status = 'pending'`,
      ),
    ).toEqual({ count: 0 });
    expect(
      await db.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM ai_rule_hits
          WHERE status = 'skipped'`,
      ),
    ).toEqual({ count: 10 });
  });

  it('backfills samples for rules approved before hit tracking existed', async () => {
    await prepareApprovedRule();
    await db.run('DELETE FROM ai_rule_hits');
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });
    mockVerdict('correct');

    await expect(auditApprovedRules()).resolves.toMatchObject({
      status: 'ok',
      audited: 1,
      confirmed: 1,
    });

    expect(runWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the auditor when the rule engine recorded no hit', async () => {
    await db.insertAccount({ id: 'checking', name: 'checking' });
    await db.insertCategoryGroup({ id: 'group1', name: 'Expenses' });
    await db.insertCategory({
      id: 'groceries',
      name: 'Groceries',
      cat_group: 'group1',
    });
    const payeeId = await db.insertPayee({ name: 'Extra' });
    await db.insertTransaction({
      id: 'txn1',
      account: 'checking',
      payee: payeeId,
      category: 'groceries',
      imported_payee: 'SOMETHING ELSE ENTIRELY',
      amount: -1000,
      date: '2026-01-05',
    });
    const proposalId = await createRuleProposal({
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
    await resolveRuleProposal({ id: proposalId, action: 'approve' });
    await setAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true });

    await expect(auditApprovedRules()).resolves.toEqual({
      status: 'no-pending',
    });

    expect(runWorkflowMock).not.toHaveBeenCalled();
  });
});
