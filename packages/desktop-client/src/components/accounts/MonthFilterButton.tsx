import { useState } from 'react';
import { Dialog, DialogTrigger } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCalendar } from '@actual-app/components/icons/v1';
import { Popover } from '@actual-app/components/popover';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { MonthInput } from '#components/util/MonthInput';

type MonthFilterButtonProps = {
  onApply: (condition: {
    customName: string;
    queryFilter: Record<string, unknown>;
  }) => void;
};

/** Quick "jump to a month" filter, separate from the full filter
 * builder — a single pick applies a date-range filter to the register. */
export function MonthFilterButton({ onApply }: MonthFilterButtonProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(monthUtils.currentMonth());
  const [isOpen, setIsOpen] = useState(false);

  const onChange = (newMonth: string) => {
    setMonth(newMonth);
    onApply({
      customName: t('Month {{month}}', {
        month: monthUtils.format(newMonth, 'MMM yyyy'),
      }),
      queryFilter: {
        $and: [
          { date: { $gte: monthUtils.firstDayOfMonth(newMonth) } },
          { date: { $lte: monthUtils.lastDayOfMonth(newMonth) } },
        ],
      },
    });
    setIsOpen(false);
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button variant="bare" aria-label={t('Jump to month')}>
        <SvgCalendar width={13} height={13} />
      </Button>

      <Popover style={{ padding: 10 }}>
        <Dialog>
          <View style={{ width: 200 }}>
            <MonthInput
              id="account-month-filter"
              value={month}
              onChange={onChange}
            />
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
