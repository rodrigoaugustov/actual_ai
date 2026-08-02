import { buildReportTransactionsQuery } from '@actual-app/core/shared/report-transactions-query';

import { ReportOptions } from '#components/reports/ReportOptions';

export function makeQuery(
  name: string,
  startDate: string,
  endDate: string,
  interval: string,
  conditionsOpKey: string,
  filters: unknown[],
  excludeTransfers = false,
) {
  const intervalGroup =
    interval === 'Monthly'
      ? { $month: '$date' }
      : interval === 'Yearly'
        ? { $year: '$date' }
        : { $day: '$date' };
  const intervalFilter =
    interval === 'Weekly'
      ? '$day'
      : '$' + ReportOptions.intervalMap.get(interval)?.toLowerCase() || 'month';

  return buildReportTransactionsQuery({
    name,
    startDate,
    endDate,
    intervalGroup,
    intervalFilter,
    conditionsOpKey,
    filters,
    excludeTransfers,
  });
}
