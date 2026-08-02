import React from 'react';

import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { getSpendingBreakdown } from '#components/budget/util';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';
import { trackingBudget } from '#spreadsheet/bindings';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { fraction } from './fraction';
import { PieProgress } from './PieProgress';

type ExpenseProgressProps = {
  current: Binding<'tracking-budget', 'total-spent'>;
  target: Binding<'tracking-budget', 'total-budgeted'>;
};
export function ExpenseProgress({ current, target }: ExpenseProgressProps) {
  let totalSpent = useTrackingSheetValue(current) || 0;
  const totalTransfers =
    useTrackingSheetValue(trackingBudget.totalTransfers) || 0;
  const [separateTransfers] = useSyncedPref('separateTransfersFromSpending');
  const totalBudgeted = useTrackingSheetValue(target) || 0;

  if (separateTransfers === 'true') {
    totalSpent = getSpendingBreakdown(totalSpent, totalTransfers).spending;
  }

  // Reverse total spent, and also set a bottom boundary of 0 (in case
  // income goes into an expense category and it's "positive", don't
  // show that in the graph)
  totalSpent = Math.max(-totalSpent, 0);

  let frac;
  let over = false;

  if (totalSpent > totalBudgeted) {
    frac = (totalSpent - totalBudgeted) / totalBudgeted;
    over = true;
  } else {
    frac = fraction(totalSpent, totalBudgeted);
  }

  return (
    <PieProgress
      progress={frac}
      color={
        over ? nossoCaderninho.color.limit : nossoCaderninho.color.commitment
      }
      backgroundColor={
        over
          ? nossoCaderninho.color.limitSoft
          : nossoCaderninho.color.partnershipSoft
      }
      style={{ width: 20, height: 20 }}
    />
  );
}
