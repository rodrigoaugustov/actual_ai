import { useTranslation } from 'react-i18next';

import { CapacityRail as CapacityRailFrame } from '#components/budget/CapacityRail';
import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { useFormat } from '#hooks/useFormat';
import { trackingBudget } from '#spreadsheet/bindings';

type CapacityRailProps = {
  isProjected: boolean;
};

export function CapacityRail({ isProjected }: CapacityRailProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const planned =
    Math.abs(useTrackingSheetValue(trackingBudget.totalBudgetedExpense) ?? 0) ||
    0;
  const used =
    Math.abs(useTrackingSheetValue(trackingBudget.totalSpent) ?? 0) || 0;
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
          label: t('Used'),
          value: format(used, 'financial'),
          tone: isOverPlan ? 'limit' : 'commitment',
        },
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
