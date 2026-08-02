import { q } from './query';
import type { ObjectExpression } from './query';

type ReportTransactionsQueryOptions = {
  name: string;
  startDate: string;
  endDate: string;
  intervalGroup: ObjectExpression;
  intervalFilter: string;
  conditionsOpKey: string;
  filters: unknown[];
  excludeTransfers?: boolean;
};

export function buildReportTransactionsQuery({
  name,
  startDate,
  endDate,
  intervalGroup,
  intervalFilter,
  conditionsOpKey,
  filters,
  excludeTransfers = false,
}: ReportTransactionsQueryOptions) {
  let query = q('transactions')
    .filter({
      [conditionsOpKey]: filters,
    })
    .filter({
      $and: [
        { date: { $transform: intervalFilter, $gte: startDate } },
        { date: { $transform: intervalFilter, $lte: endDate } },
      ],
    })
    .filter(
      name === 'assets' ? { amount: { $gt: 0 } } : { amount: { $lt: 0 } },
    );

  if (excludeTransfers) {
    query = query.filter({ transfer_id: null });
  }

  return query
    .groupBy([
      intervalGroup,
      { $id: '$account' },
      { $id: '$payee' },
      { $id: '$category' },
      { $id: '$payee.transfer_acct.id' },
    ])
    .select([
      { date: intervalGroup },
      { category: { $id: '$category.id' } },
      { categoryHidden: { $id: '$category.hidden' } },
      { categoryIncome: { $id: '$category.is_income' } },
      { categoryGroup: { $id: '$category.group.id' } },
      { categoryGroupHidden: { $id: '$category.group.hidden' } },
      { account: { $id: '$account.id' } },
      { accountOffBudget: { $id: '$account.offbudget' } },
      { payee: { $id: '$payee.id' } },
      { transferAccount: { $id: '$payee.transfer_acct.id' } },
      { amount: { $sum: '$amount' } },
    ]);
}
