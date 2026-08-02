import { useTranslation } from 'react-i18next';

import { CapacityRail as CapacityRailFrame } from '#components/budget/CapacityRail';
import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { getSpendingBreakdown } from '#components/budget/util';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { trackingBudget } from '#spreadsheet/bindings';
type CapacityRailProps = {
  isProjected: boolean;
};

export function CapacityRail({ isProjected }: CapacityRailProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const [separateTransfers] = useSyncedPref('separateTransfersFromSpending');
  const planned =
    Math.abs(useTrackingSheetValue(trackingBudget.totalBudgetedExpense) ?? 0) ||
    0;
  const totalSpent = useTrackingSheetValue(trackingBudget.totalSpent) ?? 0;
  const totalTransfers =
    useTrackingSheetValue(trackingBudget.totalTransfers) ?? 0;
  const breakdown = getSpendingBreakdown(totalSpent, totalTransfers);
  const used = Math.abs(
    separateTransfers === 'true' ? breakdown.spending : totalSpent,
  );
  const remainingInPlan = planned - used;
  const projectedSavings =
    useTrackingSheetValue(
      isProjected
        ? trackingBudget.totalBudgetedSaved
        : trackingBudget.totalSaved,
    ) ?? 0;
  const isOverPlan = planned > 0 && used > planned;
  const usedRatio =
    planned > 0 ? Math.min((used / planned) * 100, 100) : used > 0 ? 100 : 0;

  return (
    <CapacityRailFrame
      metrics={[
        {
          label: t('Planned'),
          value: format(planned, 'financial'),
          tone: 'partnership',
        },
        {
          label: t(separateTransfers === 'true' ? 'Spent' : 'Used'),
          value: format(
            separateTransfers === 'true' ? breakdown.spending : used,
            'financial',
          ),
          tone: isOverPlan ? 'limit' : 'commitment',
        },
        ...(separateTransfers === 'true'
          ? [
              {
                label: t('Transfers'),
                value: format(breakdown.transfers, 'financial'),
                tone: 'partnership' as const,
              },
              {
                label: t('Net spending'),
                value: format(breakdown.net, 'financial'),
                tone: 'commitment' as const,
              },
            ]
          : []),
        {
          label: t('Remaining in plan'),
          value: format(remainingInPlan, 'financial'),
          tone: remainingInPlan < 0 ? 'limit' : 'balance',
        },
        {
          label: isProjected ? t('Projected savings') : t('Saved'),
          value: format(projectedSavings, 'financial'),
          tone: projectedSavings < 0 ? 'limit' : 'balance',
        },
      ]}
      usedRatio={usedRatio}
      isOverPlan={isOverPlan}
    />
  );
}
