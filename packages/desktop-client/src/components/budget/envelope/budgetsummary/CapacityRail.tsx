import { useTranslation } from 'react-i18next';

import { CapacityRail as CapacityRailFrame } from '#components/budget/CapacityRail';
import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { getSpendingBreakdown } from '#components/budget/util';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget } from '#spreadsheet/bindings';

import { ToBudget } from './ToBudget';

type CapacityRailProps = {
  month: string;
  prevMonthName: string;
  onBudgetAction: (month: string, action: string, arg?: unknown) => void;
};

export function CapacityRail({
  month,
  prevMonthName,
  onBudgetAction,
}: CapacityRailProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const [separateTransfers] = useSyncedPref('separateTransfersFromSpending');
  const budgeted =
    Math.abs(
      useEnvelopeSheetValue({
        name: envelopeBudget.totalBudgeted,
        value: 0,
      }) ?? 0,
    ) || 0;
  const totalSpent =
    useEnvelopeSheetValue({
      name: envelopeBudget.totalSpent,
      value: 0,
    }) ?? 0;
  const totalTransfers =
    useEnvelopeSheetValue({
      name: envelopeBudget.totalTransfers,
      value: 0,
    }) ?? 0;
  const breakdown = getSpendingBreakdown(totalSpent, totalTransfers);
  const used = Math.abs(
    separateTransfers === 'true' ? breakdown.spending : totalSpent,
  );
  const remainingInPlan = budgeted - used;
  const isOverPlan = budgeted > 0 && used > budgeted;
  const usedRatio =
    budgeted > 0 ? Math.min((used / budgeted) * 100, 100) : used > 0 ? 100 : 0;

  return (
    <CapacityRailFrame
      metrics={[
        {
          label: t('Planned'),
          value: format(budgeted, 'financial'),
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
      ]}
      action={
        <ToBudget
          month={month}
          prevMonthName={prevMonthName}
          onBudgetAction={onBudgetAction}
          style={{ alignItems: 'flex-start' }}
          amountStyle={{
            fontSize: 16,
            fontWeight: 650,
            lineHeight: 1.2,
          }}
        />
      }
      usedRatio={usedRatio}
      isOverPlan={isOverPlan}
    />
  );
}
