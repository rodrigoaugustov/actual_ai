// @ts-strict-ignore
import React from 'react';
import type { ComponentProps } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheveronLeft,
  SvgCheveronRight,
} from '@actual-app/components/icons/v1';
import { SvgCalendar } from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import * as monthUtils from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { useLocale } from '#hooks/useLocale';
import { nossoCaderninho } from '#style/nossoCaderninho';

import type { MonthPicker } from './MonthPicker';

type BudgetPageHeaderProps = {
  startMonth: string;
  onMonthSelect: (month: string) => void;
  numMonths: number;
  monthBounds: ComponentProps<typeof MonthPicker>['monthBounds'];
};

export function BudgetPageHeader({
  startMonth,
  onMonthSelect,
  numMonths,
  monthBounds,
}: BudgetPageHeaderProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const currentMonth = monthUtils.currentMonth();
  const endMonth = monthUtils.addMonths(startMonth, numMonths - 1);
  const canGoPrevious = startMonth > monthBounds.start;
  const canGoNext = endMonth < monthBounds.end;
  const monthLabel =
    numMonths === 1
      ? monthUtils.format(startMonth, 'MMMM yyyy', locale)
      : t('{{start}} — {{end}}', {
          start: monthUtils.format(startMonth, 'MMM', locale),
          end: monthUtils.format(endMonth, 'MMM yyyy', locale),
        });

  return (
    <header className={headerClass}>
      <div className={identityClass}>
        <h1>
          <Trans>Planning</Trans>
        </h1>
        <Text>
          <Trans>Agree on the month before the month decides for you.</Trans>
        </Text>
      </div>

      <nav className={monthNavigationClass} aria-label={t('Budget month')}>
        <Button
          variant="bare"
          aria-label={t('Previous month')}
          isDisabled={!canGoPrevious}
          onPress={() => onMonthSelect(monthUtils.prevMonth(startMonth))}
        >
          <SvgCheveronLeft width={16} height={16} />
        </Button>
        <strong>{monthLabel}</strong>
        <Button
          variant="bare"
          aria-label={t('Next month')}
          isDisabled={!canGoNext}
          onPress={() => onMonthSelect(monthUtils.nextMonth(startMonth))}
        >
          <SvgCheveronRight width={16} height={16} />
        </Button>
      </nav>

      {startMonth !== currentMonth && (
        <Button
          variant="bare"
          className={todayButtonClass}
          onPress={() => onMonthSelect(currentMonth)}
        >
          <SvgCalendar width={15} height={15} />
          <Trans>Go to today</Trans>
        </Button>
      )}
    </header>
  );
}

const headerClass = css({
  minHeight: 72,
  padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: 'minmax(190px, 1fr) auto minmax(190px, 1fr)',
  alignItems: 'center',
  gap: nossoCaderninho.space.lg,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.enamel,
  fontFamily: nossoCaderninho.font.family,
  '@media (max-width: 899px)': {
    gridTemplateColumns: '1fr',
  },
});

const identityClass = css({
  minWidth: 0,
  display: 'grid',
  gap: 3,
  '& h1': {
    margin: 0,
    fontSize: 20,
    fontWeight: 720,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  '& span': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 12,
  },
});

const monthNavigationClass = css({
  minWidth: 230,
  minHeight: 40,
  display: 'grid',
  gridTemplateColumns: '40px minmax(130px, 1fr) 40px',
  alignItems: 'center',
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.rail}`,
  borderRadius: nossoCaderninho.radius.control,
  '& button': {
    minWidth: 40,
    minHeight: 38,
    color: nossoCaderninho.color.partnership,
    borderRadius: nossoCaderninho.radius.control,
  },
  '& strong': {
    overflow: 'hidden',
    fontSize: 15,
    fontWeight: 650,
    textAlign: 'center',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

const todayButtonClass = css({
  minHeight: 38,
  justifySelf: 'end',
  gap: nossoCaderninho.space.xs,
  color: `${nossoCaderninho.color.partnership} !important`,
  backgroundColor: `${nossoCaderninho.color.partnershipSoft} !important`,
  borderRadius: nossoCaderninho.radius.control,
});
