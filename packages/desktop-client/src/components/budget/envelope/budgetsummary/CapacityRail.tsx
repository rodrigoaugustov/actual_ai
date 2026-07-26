import { useTranslation } from 'react-i18next';

import { CapacityRail as CapacityRailFrame } from '#components/budget/CapacityRail';
import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { useFormat } from '#hooks/useFormat';
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
  const budgeted =
    Math.abs(
      useEnvelopeSheetValue({
        name: envelopeBudget.totalBudgeted,
        value: 0,
      }) ?? 0,
    ) || 0;
  const used =
    Math.abs(
      useEnvelopeSheetValue({
        name: envelopeBudget.totalSpent,
        value: 0,
      }) ?? 0,
    ) || 0;
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
          label: t('Used'),
          value: format(used, 'financial'),
          tone: isOverPlan ? 'limit' : 'commitment',
        },
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
