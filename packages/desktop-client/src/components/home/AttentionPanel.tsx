import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { SvgInboxFull } from '@actual-app/components/icons/v1';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import type { TFunction } from 'i18next';

import { FinancialText } from '#components/FinancialText';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { usePayeesById } from '#hooks/usePayees';
import { useSheetValue } from '#hooks/useSheetValue';
import { useTransactions } from '#hooks/useTransactions';
import { uncategorizedTransactions } from '#queries';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { HousePanel } from './HousePanel';

type AttentionPanelProps = {
  month: string;
};

export function AttentionPanel({ month }: AttentionPanelProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();
  const { data: payeesById = {} } = usePayeesById();
  const accountsById = Object.fromEntries(
    accounts.map(account => [account.id, account]),
  );

  const baseQuery = useMemo(
    () =>
      uncategorizedTransactions().filter({
        date: { $gte: `${month}-01`, $lte: `${month}-31` },
      }),
    [month],
  );
  const countBinding = useMemo(
    () => ({
      name: 'uncategorized-amount' as const,
      query: baseQuery.calculate({ $count: '$id' }),
    }),
    [baseQuery],
  );
  const transactionQuery = useMemo(
    () => baseQuery.select('*').orderBy({ date: 'desc' }),
    [baseQuery],
  );
  const count =
    useSheetValue<'envelope-budget', 'uncategorized-amount'>(countBinding) ?? 0;
  const { transactions, isLoading, isError } = useTransactions({
    query: transactionQuery,
    options: { pageSize: 8 },
  });

  return (
    <HousePanel
      title={
        <span className={panelTitleClass}>
          <Trans>Needs attention</Trans>
          {count > 0 && (
            <span
              className={countClass}
              aria-label={t('{{count}} movements', { count })}
            >
              {count}
            </span>
          )}
        </span>
      }
      description={<Trans>Movements without a category</Trans>}
    >
      {isLoading ? (
        <AttentionSkeleton label={t('Loading movements')} />
      ) : isError ? (
        <PanelMessage tone="error">
          <Trans>
            Movements could not be loaded. Try opening the account register.
          </Trans>
        </PanelMessage>
      ) : transactions.length === 0 ? (
        <PanelMessage>
          <Trans>No movements need categorization this month.</Trans>
        </PanelMessage>
      ) : (
        <div className={rowsClass}>
          <div className={tableHeaderClass} aria-hidden>
            <span>
              <Trans>Date</Trans>
            </span>
            <span>
              <Trans>Description</Trans>
            </span>
            <span>
              <Trans>Account</Trans>
            </span>
            <span>
              <Trans>Amount</Trans>
            </span>
          </div>
          {transactions.slice(0, 8).map(transaction => (
            <NavLink
              key={transaction.id}
              to="/accounts/uncategorized"
              className={rowClass}
            >
              <time dateTime={transaction.date}>
                {formatShortDate(transaction.date)}
              </time>
              <span className={descriptionClass}>
                {getTransactionDescription(transaction, payeesById, t)}
              </span>
              <span className={accountClass}>
                {accountsById[transaction.account]?.name ?? t('Account')}
              </span>
              <FinancialText as="span">
                {format(transaction.amount, 'financial')}
              </FinancialText>
            </NavLink>
          ))}
        </div>
      )}

      {count > 0 && (
        <NavLink to="/accounts/uncategorized" className={footerActionClass}>
          <SvgInboxFull width={16} height={16} />
          <span>
            <Trans count={count}>Review {{ count }} movements</Trans>
          </span>
          <span aria-hidden>→</span>
        </NavLink>
      )}
    </HousePanel>
  );
}

function getTransactionDescription(
  transaction: TransactionEntity,
  payeesById: Record<string, { name: string }>,
  t: TFunction,
): string {
  if (transaction.payee && payeesById[transaction.payee]) {
    return payeesById[transaction.payee].name;
  }
  return (
    transaction.imported_payee ||
    transaction.notes ||
    t('Movement without description')
  );
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function AttentionSkeleton({ label }: { label: string }) {
  return (
    <output className={skeletonRowsClass} aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} />
      ))}
    </output>
  );
}

function PanelMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'error';
}) {
  return (
    <p className={tone === 'error' ? errorMessageClass : messageClass}>
      {children}
    </p>
  );
}

const panelTitleClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
});

const countClass = css({
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: nossoCaderninho.radius.status,
  color: nossoCaderninho.color.plate,
  backgroundColor: nossoCaderninho.color.limit,
  fontSize: 12,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
});

const rowsClass = css({
  minWidth: 0,
});

const tableHeaderClass = css({
  minHeight: 34,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: '58px minmax(130px, 1.4fr) minmax(100px, 1fr) 96px',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: nossoCaderninho.color.signalSoft,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 11,
  '@media (max-width: 729px)': {
    display: 'none',
  },
  '@container (max-width: 439px)': {
    display: 'none',
  },
});

const rowClass = css({
  minHeight: 45,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: '58px minmax(130px, 1.4fr) minmax(100px, 1fr) 96px',
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
    justifySelf: 'end',
    whiteSpace: 'nowrap',
  },
  '@media (max-width: 729px)': {
    minHeight: 54,
    gridTemplateColumns: '48px minmax(0, 1fr) auto',
    gridTemplateAreas: '"date description amount" "date account amount"',
    '& time': {
      gridArea: 'date',
      color: nossoCaderninho.color.graphiteSubdued,
    },
    '& > :last-child': {
      gridArea: 'amount',
    },
  },
  '@container (max-width: 439px)': {
    minHeight: 54,
    gridTemplateColumns: '48px minmax(0, 1fr) auto',
    gridTemplateAreas: '"date description amount" "date account amount"',
    '& time': {
      gridArea: 'date',
      color: nossoCaderninho.color.graphiteSubdued,
    },
    '& > :last-child': {
      gridArea: 'amount',
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
});

const descriptionClass = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@media (max-width: 729px)': {
    gridArea: 'description',
    alignSelf: 'end',
    fontSize: 13,
    fontWeight: 600,
  },
  '@container (max-width: 439px)': {
    gridArea: 'description',
    alignSelf: 'end',
    fontSize: 13,
    fontWeight: 600,
  },
});

const accountClass = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: nossoCaderninho.color.graphiteSubdued,
  '@media (max-width: 729px)': {
    gridArea: 'account',
    alignSelf: 'start',
    fontSize: 11,
  },
  '@container (max-width: 439px)': {
    gridArea: 'account',
    alignSelf: 'start',
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
  '@media (max-width: 729px)': {
    minHeight: 104,
  },
});

const errorMessageClass = css(messageClass, {
  color: nossoCaderninho.color.limit,
  backgroundColor: nossoCaderninho.color.limitSoft,
});

const skeletonRowsClass = css({
  minHeight: 226,
  padding: nossoCaderninho.space.lg,
  display: 'grid',
  alignContent: 'start',
  gap: nossoCaderninho.space.md,
  '& span': {
    height: 20,
    borderRadius: nossoCaderninho.radius.control,
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
});
