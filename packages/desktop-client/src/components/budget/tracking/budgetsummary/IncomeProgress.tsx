import React from 'react';
import type { ComponentProps } from 'react';

import type { CellValue } from '#components/spreadsheet/CellValue';
import { useSheetValue } from '#hooks/useSheetValue';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { fraction } from './fraction';
import { PieProgress } from './PieProgress';

type IncomeProgressProps = {
  current: ComponentProps<typeof CellValue>['binding'];
  target: ComponentProps<typeof CellValue>['binding'];
};
export function IncomeProgress({ current, target }: IncomeProgressProps) {
  let totalIncome = useSheetValue(current) || 0;
  const totalBudgeted = useSheetValue(target) || 0;

  let over = false;

  if (totalIncome < 0) {
    over = true;
    totalIncome = -totalIncome;
  }

  const frac = fraction(totalIncome, totalBudgeted);

  return (
    <PieProgress
      progress={frac}
      color={over ? nossoCaderninho.color.limit : nossoCaderninho.color.balance}
      backgroundColor={
        over
          ? nossoCaderninho.color.limitSoft
          : nossoCaderninho.color.balanceSoft
      }
      style={{ width: 20, height: 20 }}
    />
  );
}
