// @ts-strict-ignore
import React from 'react';
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { CellValue } from '#components/spreadsheet/CellValue';
import type { Binding, SheetFields } from '#spreadsheet';
import { nossoCaderninho } from '#style/nossoCaderninho';

type BudgetTotalProps<
  CurrentField extends SheetFields<'tracking-budget'>,
  TargetField extends SheetFields<'tracking-budget'>,
> = {
  title: ReactNode;
  current: Binding<'tracking-budget', CurrentField>;
  target: Binding<'tracking-budget', TargetField>;
  ProgressComponent: ComponentType<{ current; target }>;
  style?: CSSProperties;
};
export function BudgetTotal<
  CurrentField extends SheetFields<'tracking-budget'>,
  TargetField extends SheetFields<'tracking-budget'>,
>({
  title,
  current,
  target,
  ProgressComponent,
  style,
}: BudgetTotalProps<CurrentField, TargetField>) {
  return (
    <View
      style={{
        lineHeight: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        fontSize: 14,
        ...style,
      }}
    >
      <ProgressComponent current={current} target={target} />

      <View style={{ marginLeft: 10, ...styles.tnum }}>
        <View>
          <Text style={{ color: nossoCaderninho.color.graphiteSubdued }}>
            {title}
          </Text>
        </View>

        <Text>
          <Trans
            i18nKey="<allocatedAmount /> <italic>of <totalAmount /></italic>"
            components={{
              allocatedAmount: <CellValue binding={current} type="financial" />,
              italic: (
                <Text
                  style={{
                    color: nossoCaderninho.color.graphiteSubdued,
                    fontStyle: 'italic',
                  }}
                />
              ),
              totalAmount: <CellValue binding={target} type="financial" />,
            }}
          />
        </Text>
      </View>
    </View>
  );
}
