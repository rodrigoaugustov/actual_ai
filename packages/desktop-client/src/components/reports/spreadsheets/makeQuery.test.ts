import { describe, expect, it } from 'vitest';

import { makeQuery } from './makeQuery';

const queryArgs: [string, string, string, string, string, unknown[]] = [
  'debts',
  '2026-01-01',
  '2026-01-31',
  'Monthly',
  '$and',
  [{ account: { $oneof: ['checking'] } }],
];

function getSelectKeys(query: ReturnType<typeof makeQuery>) {
  return query.serialize().selectExpressions.map(expression => {
    if (typeof expression === 'string') {
      return expression;
    }
    return Object.keys(expression)[0];
  });
}

function matchesFlatFilter(
  filter: Record<string, unknown>,
  row: Record<string, unknown>,
) {
  return Object.entries(filter).every(([field, expected]) => {
    return row[field] === expected;
  });
}

describe('makeQuery transfer preference', () => {
  it('preserves the previous query AST when transfer separation is off', () => {
    const state = makeQuery(...queryArgs).serialize();

    expect(state.filterExpressions).toEqual([
      { $and: queryArgs[5] },
      {
        $and: [
          { date: { $transform: '$month', $gte: '2026-01-01' } },
          { date: { $transform: '$month', $lte: '2026-01-31' } },
        ],
      },
      { amount: { $lt: 0 } },
    ]);
    expect(state.groupExpressions).toEqual([
      { $month: '$date' },
      { $id: '$account' },
      { $id: '$payee' },
      { $id: '$category' },
      { $id: '$payee.transfer_acct.id' },
    ]);
    expect(getSelectKeys(makeQuery(...queryArgs))).toEqual([
      'date',
      'category',
      'categoryHidden',
      'categoryIncome',
      'categoryGroup',
      'categoryGroupHidden',
      'account',
      'accountOffBudget',
      'payee',
      'transferAccount',
      'amount',
    ]);
  });

  it('adds only the authoritative pre-aggregation transfer filter when on', () => {
    const offState = makeQuery(...queryArgs, false).serialize();
    const onState = makeQuery(...queryArgs, true).serialize();

    expect(onState.filterExpressions).toEqual([
      ...offState.filterExpressions,
      { transfer_id: null },
    ]);
    expect(onState.groupExpressions).toEqual(offState.groupExpressions);
    expect(onState.selectExpressions).toEqual(offState.selectExpressions);
    expect(onState.groupExpressions).not.toContainEqual({
      $id: '$transfer_id',
    });
  });

  it.each([
    ['Category', 'category'],
    ['CategoryGroup', 'categoryGroup'],
    ['Payee', 'payee'],
    ['Account', 'account'],
    ['Month', 'date'],
  ])('keeps the %s grouping projection available', (_groupBy, resultField) => {
    expect(getSelectKeys(makeQuery(...queryArgs, true))).toContain(resultField);
  });

  it.each([
    {
      scenario: 'ordinary transaction',
      transfer_id: null,
      transferAccount: null,
      isExcluded: false,
    },
    {
      scenario: 'orphan transfer link',
      transfer_id: 'missing-twin',
      transferAccount: 'savings',
      isExcluded: true,
    },
    {
      scenario: 'tombstoned twin',
      transfer_id: 'dead-twin',
      transferAccount: 'savings',
      isExcluded: true,
    },
    {
      scenario: 'transfer payee without a link',
      transfer_id: null,
      transferAccount: 'savings',
      isExcluded: false,
    },
    {
      scenario: 'partial sync with a not-yet-arrived twin',
      transfer_id: 'remote-twin',
      transferAccount: null,
      isExcluded: true,
    },
  ])(
    'classifies $scenario from transfer_id, independently of the payee',
    ({ isExcluded, scenario: _scenario, ...row }) => {
      const state = makeQuery(...queryArgs, true).serialize();
      const transferFilter = state.filterExpressions.at(-1);

      if (!transferFilter) {
        throw new Error('Expected the transfer filter to be present');
      }

      expect(transferFilter).toEqual({ transfer_id: null });
      expect(matchesFlatFilter(transferFilter, row)).toBe(!isExcluded);
    },
  );
});
