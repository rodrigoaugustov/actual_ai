import { loadMappings } from '#server/db/mappings';
import {
  getRules,
  insertRule,
  loadRules,
} from '#server/transactions/transaction-rules';
import type { RuleConditionEntity } from '#types/models';

import {
  describeExistingCategoryRules,
  partitionByExistingRuleCoverage,
} from './rule-coverage';

beforeEach(global.emptyDatabase());

async function prepare() {
  await loadMappings();
  await loadRules();
}

async function insertCategoryRule(condition: RuleConditionEntity) {
  await insertRule({
    stage: null,
    conditionsOp: 'and',
    conditions: [condition],
    actions: [{ field: 'category', op: 'set', value: 'groceries' }],
  });
  // insertRule only writes to the DB — the in-memory cache getRules() reads
  // from has to be refreshed explicitly, same as rule-meta.test.ts does.
  await loadRules();
}

describe('partitionByExistingRuleCoverage', () => {
  it('treats every candidate as uncovered when there are no category rules', async () => {
    await prepare();

    const { covered, uncovered } = partitionByExistingRuleCoverage([
      {
        payeeId: 'p1',
        payeeName: 'iFood',
        sampleDescriptions: ['IFOOD*PEDIDO'],
      },
    ]);

    expect(covered).toEqual([]);
    expect(uncovered).toHaveLength(1);
  });

  it('detects coverage from a rule keyed on the raw imported_payee (the field the miner itself uses)', async () => {
    await prepare();
    await insertCategoryRule({
      field: 'imported_payee',
      op: 'contains',
      value: 'ifood',
      type: 'string',
    });

    const { covered, uncovered } = partitionByExistingRuleCoverage([
      {
        payeeId: 'p1',
        payeeName: 'iFood',
        sampleDescriptions: ['IFOOD*PEDIDO 123'],
      },
    ]);

    expect(uncovered).toEqual([]);
    expect(covered).toHaveLength(1);
  });

  it('detects coverage from a rule keyed on the resolved payee ("beneficiário" in the UI) even though the miner proposes on imported_payee', async () => {
    // Reproduces the reported bug: a manual rule already exists for this
    // payee via the resolved payee (the "Payee" field a user picks in the
    // rule builder), so the miner must not propose a second, redundant rule
    // keyed on the raw imported description.
    await prepare();
    await insertCategoryRule({
      field: 'payee',
      op: 'is',
      value: 'payee-ifood',
      type: 'id',
    });

    const { covered, uncovered } = partitionByExistingRuleCoverage([
      {
        payeeId: 'payee-ifood',
        payeeName: 'iFood',
        sampleDescriptions: ['IFOOD*PEDIDO 123', 'IFOOD*OUTRO 456'],
      },
    ]);

    expect(uncovered).toEqual([]);
    expect(covered).toHaveLength(1);
  });

  it('does not treat an unrelated payee as covered', async () => {
    await prepare();
    await insertCategoryRule({
      field: 'payee',
      op: 'is',
      value: 'payee-ifood',
      type: 'id',
    });

    const { covered, uncovered } = partitionByExistingRuleCoverage([
      {
        payeeId: 'payee-uber',
        payeeName: 'Uber',
        sampleDescriptions: ['UBER *TRIP'],
      },
    ]);

    expect(covered).toEqual([]);
    expect(uncovered).toHaveLength(1);
  });
});

describe('describeExistingCategoryRules', () => {
  it('describes each category rule in plain language with the category name resolved', async () => {
    await prepare();
    await insertCategoryRule({
      field: 'imported_payee',
      op: 'contains',
      value: 'ifood',
      type: 'string',
    });

    const descriptions = describeExistingCategoryRules([
      { id: 'groceries', name: 'Groceries' },
    ]);

    expect(descriptions).toHaveLength(1);
    expect(descriptions[0]).toContain('imported_payee');
    expect(descriptions[0]).toContain('ifood');
    expect(descriptions[0]).toContain('Groceries');
  });

  it('ignores rules that do not set a category', async () => {
    await prepare();
    await insertRule({
      stage: null,
      conditionsOp: 'and',
      conditions: [
        {
          field: 'imported_payee',
          op: 'contains',
          value: 'ifood',
          type: 'string',
        },
      ],
      actions: [{ op: 'append-notes', value: 'delivery' }],
    });
    await loadRules();

    expect(describeExistingCategoryRules([])).toEqual([]);
    expect(getRules()).toHaveLength(1);
  });
});
