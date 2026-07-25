import { useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgArrowThinLeft,
  SvgArrowThinRight,
} from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  StatementWithDerived,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

const SCROLL_AMOUNT = 380;

type StatementsPanelProps = {
  account: AccountEntity;
  onApplyFilter: (condition: {
    customName: string;
    queryFilter: Record<string, unknown>;
  }) => void;
};

export function StatementsPanel({
  account,
  onApplyFilter,
}: StatementsPanelProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const { data: statements = [] } = useQuery({
    queryKey: ['credit-card-statements', account.id],
    queryFn: () =>
      send('credit-card/get-statements', { accountId: account.id }),
    enabled: account.closing_day != null && account.due_day != null,
  });

  const today = monthUtils.currentDay();

  // Keep every past/current statement plus any future one that actually
  // has activity (installments, imported transactions); only far-future
  // empty placeholders (generated to cover the rolling horizon) are
  // hidden, so a card with future-dated data never buries "now" the way
  // a fixed-size slice of a future-first list could.
  const visible = useMemo(
    () =>
      [...statements]
        .filter(
          statement => statement.start_date <= today || statement.balance !== 0,
        )
        .sort((a, b) => (a.start_date < b.start_date ? -1 : 1)),
    [statements, today],
  );

  const anchorId = useMemo(() => {
    const current = visible.find(
      statement => statement.start_date <= today && today <= statement.end_date,
    );
    return current?.id ?? visible[visible.length - 1]?.id;
  }, [visible, today]);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
    });
  }, [anchorId]);

  if (account.closing_day == null || account.due_day == null) {
    return null;
  }

  const scrollBy = (amount: number) =>
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });

  // Mirrors the same priority used to compute the statement's own
  // balance: a transaction with a real bill link only ever belongs to
  // the statement carrying that same link, never to another one whose
  // date range it happens to overlap.
  const onFilterStatement = (statement: StatementWithDerived) => {
    const dateRange = {
      $and: [
        { date: { $gte: statement.start_date } },
        { date: { $lte: statement.end_date } },
      ],
    };
    onApplyFilter({
      customName: t('Statement {{month}}', {
        month: monthUtils.format(statement.end_date, 'MMM yyyy'),
      }),
      queryFilter: statement.pluggy_bill_id
        ? {
            $or: [
              { pluggy_bill_id: statement.pluggy_bill_id },
              { $and: [{ pluggy_bill_id: null }, dateRange] },
            ],
          }
        : dateRange,
    });
  };

  const onTogglePaid = async (statement: StatementWithDerived) => {
    if (statement.status === 'paid') {
      await send('credit-card/unmark-statement-paid', { id: statement.id });
      await queryClient.invalidateQueries({
        queryKey: ['credit-card-statements', account.id],
      });
    } else {
      dispatch(
        pushModal({
          modal: {
            name: 'credit-card-confirm-payment',
            options: { statement, account },
          },
        }),
      );
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: '5px 15px',
      }}
      data-testid="statements-panel"
    >
      <Button
        variant="bare"
        onPress={() =>
          dispatch(
            pushModal({
              modal: {
                name: 'credit-card-installment-purchase',
                options: { account },
              },
            }),
          )
        }
      >
        <Trans>New installment purchase</Trans>
      </Button>

      {visible.length > 0 && (
        <Button
          variant="bare"
          aria-label={t('Show earlier statements')}
          onPress={() => scrollBy(-SCROLL_AMOUNT)}
        >
          <SvgArrowThinLeft style={{ width: 12, height: 12 }} />
        </Button>
      )}

      {visible.length === 0 && (
        <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
          <Trans>No statements yet.</Trans>
        </Text>
      )}

      <View
        ref={scrollRef}
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 10,
          overflowX: 'auto',
          scrollBehavior: 'smooth',
        }}
      >
        {visible.map(statement => (
          <View
            key={statement.id}
            ref={statement.id === anchorId ? anchorRef : undefined}
            style={{
              border:
                '1px solid ' +
                (statement.id === anchorId
                  ? theme.pillBorderSelected
                  : theme.tableBorder),
              borderRadius: 4,
              padding: '6px 10px',
              minWidth: 170,
              flexShrink: 0,
              cursor: 'pointer',
            }}
            title={t("Show only this statement's transactions")}
            onClick={() => onFilterStatement(statement)}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ fontWeight: 600 }}>
                {monthUtils.format(statement.end_date, 'MMM yyyy')}
              </Text>
              <StatementStatusPill status={statement.status} />
            </View>
            <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
              {monthUtils.format(statement.start_date, dateFormat)} –{' '}
              {monthUtils.format(statement.end_date, dateFormat)}
            </Text>
            <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
              {t('Due {{date}}', {
                date: monthUtils.format(statement.due_date, dateFormat),
              })}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 4,
              }}
              onClick={e => e.stopPropagation()}
            >
              <PrivacyFilter>
                <FinancialText style={{ fontWeight: 600 }}>
                  {format(statement.balance, 'financial')}
                </FinancialText>
              </PrivacyFilter>
              {statement.status !== 'open' && (
                <Button
                  variant="bare"
                  style={{ fontSize: '0.8em' }}
                  onPress={() => onTogglePaid(statement)}
                >
                  {statement.status === 'paid' ? (
                    <Trans>Unmark paid</Trans>
                  ) : (
                    <Trans>Mark paid</Trans>
                  )}
                </Button>
              )}
            </View>
          </View>
        ))}
      </View>

      {visible.length > 0 && (
        <Button
          variant="bare"
          aria-label={t('Show later statements')}
          onPress={() => scrollBy(SCROLL_AMOUNT)}
        >
          <SvgArrowThinRight style={{ width: 12, height: 12 }} />
        </Button>
      )}
    </View>
  );
}

function StatementStatusPill({
  status,
}: {
  status: StatementWithDerived['status'];
}) {
  const colors =
    status === 'paid'
      ? { color: theme.noticeText, backgroundColor: theme.noticeBackground }
      : status === 'closed'
        ? { color: theme.warningText, backgroundColor: theme.warningBackground }
        : { color: theme.pillText, backgroundColor: theme.pillBackground };

  return (
    <Text
      style={{
        ...colors,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: '0.75em',
      }}
    >
      {status === 'paid' ? (
        <Trans>Paid</Trans>
      ) : status === 'closed' ? (
        <Trans>Closed</Trans>
      ) : (
        <Trans>Open</Trans>
      )}
    </Text>
  );
}
