import React from 'react';
import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { getSpendingBreakdown } from '#components/budget/util';
import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { trackingBudget } from '#spreadsheet/bindings';

import { BudgetTotal } from './BudgetTotal';
import { ExpenseProgress } from './ExpenseProgress';

type ExpenseTotalProps = {
  style?: CSSProperties;
};
export function ExpenseTotal({ style }: ExpenseTotalProps) {
  const { t } = useTranslation();
  const [separateTransfers] = useSyncedPref('separateTransfersFromSpending');
  const totalSpent = useTrackingSheetValue(trackingBudget.totalSpent) ?? 0;
  const totalTransfers =
    useTrackingSheetValue(trackingBudget.totalTransfers) ?? 0;
  const breakdown = getSpendingBreakdown(totalSpent, totalTransfers);
  const format = useFormat();
  return (
    <>
      <BudgetTotal
        title={t(separateTransfers === 'true' ? 'Spent' : 'Expenses')}
        current={trackingBudget.totalSpent}
        currentValue={
          separateTransfers === 'true' ? breakdown.spending : undefined
        }
        target={trackingBudget.totalBudgetedExpense}
        ProgressComponent={ExpenseProgress}
        style={style}
      />
      {separateTransfers === 'true' && (
        <FinancialText as="div" style={{ ...style, fontSize: 12 }}>
          <Trans>Transfers</Trans>: {format(breakdown.transfers, 'financial')} ·{' '}
          <Trans>Net spending</Trans>: {format(breakdown.net, 'financial')}
        </FinancialText>
      )}
    </>
  );
}
