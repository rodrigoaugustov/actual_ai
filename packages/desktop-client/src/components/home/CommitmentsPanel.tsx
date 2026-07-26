import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type { ScheduleEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { FinancialText } from '#components/FinancialText';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { usePayeesById } from '#hooks/usePayees';
import { useSchedules } from '#hooks/useSchedules';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { HousePanel } from './HousePanel';

export function CommitmentsPanel({ month }: { month: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();
  const { data: payeesById = {} } = usePayeesById();
  const monthStart = monthUtils.firstDayOfMonth(month);
  const monthEnd = monthUtils.lastDayOfMonth(month);
  const query = useMemo(
    () =>
      q('schedules')
        .select('*')
        .filter({
          completed: false,
          tombstone: false,
          next_date: {
            $gte: monthStart,
            $lte: monthEnd,
          },
        })
        .orderBy({ next_date: 'asc' }),
    [monthEnd, monthStart],
  );
  const { schedules, isLoading, error } = useSchedules({ query });
  const upcomingSchedules = schedules
    .filter(
      schedule =>
        schedule.next_date >= monthStart && schedule.next_date <= monthEnd,
    )
    .slice(0, 6);
  const accountsById = Object.fromEntries(
    accounts.map(account => [account.id, account]),
  );

  return (
    <HousePanel
      title={<Trans>Commitments</Trans>}
      description={<Trans>What is already expected</Trans>}
    >
      {isLoading ? (
        <CommitmentsSkeleton label={t('Loading commitments')} />
      ) : error ? (
        <p className={errorClass}>
          <Trans>Commitments could not be loaded.</Trans>
        </p>
      ) : upcomingSchedules.length === 0 ? (
        <p className={messageClass}>
          <Trans>No upcoming commitments were found.</Trans>
        </p>
      ) : (
        <div className={listClass}>
          {upcomingSchedules.map(schedule => (
            <CommitmentRow
              key={schedule.id}
              schedule={schedule}
              accountName={
                accountsById[schedule._account]?.name ?? t('No account')
              }
              payeeName={
                (schedule._payee && payeesById[schedule._payee]?.name) ||
                schedule.name ||
                t('Unnamed commitment')
              }
              amount={format(
                Math.abs(getScheduledAmount(schedule._amount)),
                'financial',
              )}
              date={formatDate(schedule.next_date)}
            />
          ))}
        </div>
      )}

      <NavLink to="/schedules" className={footerActionClass}>
        <SvgCalendar3 width={16} height={16} />
        <span>
          <Trans>See all commitments</Trans>
        </span>
        <span aria-hidden>→</span>
      </NavLink>
    </HousePanel>
  );
}

function CommitmentRow({
  schedule,
  payeeName,
  accountName,
  amount,
  date,
}: {
  schedule: ScheduleEntity;
  payeeName: string;
  accountName: string;
  amount: string;
  date: string;
}) {
  return (
    <NavLink to={`/schedules/${schedule.id}`} className={rowClass}>
      <time dateTime={schedule.next_date} className={dateClass}>
        {date}
      </time>
      <span className={commitmentClass}>
        <strong>{payeeName}</strong>
        <small>{accountName}</small>
      </span>
      <FinancialText as="span">{amount}</FinancialText>
    </NavLink>
  );
}

function formatDate(date: string): string {
  const parsedDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsedDate.valueOf())) {
    return date;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
  }).format(parsedDate);
}

function CommitmentsSkeleton({ label }: { label: string }) {
  return (
    <output className={skeletonClass} aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} />
      ))}
    </output>
  );
}

const listClass = css({
  minHeight: 226,
});

const rowClass = css({
  minHeight: 52,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: '52px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 12,
  textDecoration: 'none',
  transition: `background-color ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
  '& > :last-child': {
    whiteSpace: 'nowrap',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
});

const dateClass = css({
  color: nossoCaderninho.color.graphiteSubdued,
  fontVariantNumeric: 'tabular-nums',
});

const commitmentClass = css({
  minWidth: 0,
  display: 'grid',
  gap: 2,
  '& strong, & small': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& strong': {
    fontSize: 13,
    fontWeight: 650,
  },
  '& small': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
  },
});

const footerActionClass = css({
  minHeight: 48,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.partnership,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 13,
  fontWeight: 650,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const messageClass = css({
  minHeight: 226,
  margin: 0,
  padding: nossoCaderninho.space.xl,
  display: 'flex',
  alignItems: 'center',
  color: nossoCaderninho.color.graphiteSubdued,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 13,
  lineHeight: 1.45,
});

const errorClass = css(messageClass, {
  color: nossoCaderninho.color.limit,
  backgroundColor: nossoCaderninho.color.limitSoft,
});

const skeletonClass = css({
  minHeight: 226,
  padding: nossoCaderninho.space.lg,
  display: 'grid',
  alignContent: 'start',
  gap: nossoCaderninho.space.md,
  '& span': {
    height: 24,
    borderRadius: nossoCaderninho.radius.control,
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
});
