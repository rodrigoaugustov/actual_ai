import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type {
  AccountEntity,
  StatementWithDerived,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { FinancialText } from '#components/FinancialText';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { addNotification } from '#notifications/notificationsSlice';
import { aqlQuery } from '#queries/aqlQuery';
import { useDispatch } from '#redux';

import { TransactionPickerList } from './TransactionPickerList';

type TransactionSummary = {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  accountName: string | null;
};

function useTransactionSummary(id: string | null) {
  return useQuery({
    queryKey: ['transaction-summary', id],
    queryFn: async () => {
      const { data } = await aqlQuery(
        q('transactions')
          .filter({ id })
          .select([
            'id',
            'date',
            'amount',
            { payeeName: 'payee.name' },
            { accountName: 'account.name' },
          ]),
      );
      return (data[0] as TransactionSummary | undefined) ?? null;
    },
    enabled: id != null,
  });
}

type Slot = 'card' | 'counterpart';

type ConfirmStatementPaymentModalProps = {
  statement: StatementWithDerived;
  account: AccountEntity;
};

export function ConfirmStatementPaymentModal({
  statement,
  account,
}: ConfirmStatementPaymentModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();

  const [cardTransactionId, setCardTransactionId] = useState<string | null>(
    null,
  );
  const [counterpartTransactionId, setCounterpartTransactionId] = useState<
    string | null
  >(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedSuggestion, setLoadedSuggestion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    send('credit-card/suggest-statement-payment', {
      statementId: statement.id,
    })
      .then(suggestion => {
        if (cancelled) return;
        setCardTransactionId(suggestion.cardTransactionId);
        setCounterpartTransactionId(suggestion.counterpartTransactionId);
        setLoadedSuggestion(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedSuggestion(true);
          dispatch(
            addNotification({
              notification: {
                type: 'error',
                message: t(
                  'Could not suggest matching payment transactions. Search for them manually or mark the statement paid without reconciling.',
                ),
              },
            }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statement.id]);

  const cardSummary = useTransactionSummary(cardTransactionId);
  const counterpartSummary = useTransactionSummary(counterpartTransactionId);

  const onConfirm = async (close: () => void) => {
    if (
      isSaving ||
      cardTransactionId == null ||
      counterpartTransactionId == null ||
      cardSummary.isError ||
      counterpartSummary.isError ||
      cardSummary.data == null ||
      counterpartSummary.data == null
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await send('credit-card/confirm-statement-payment', {
        statementId: statement.id,
        cardTransactionId,
        counterpartTransactionId,
      });
      await queryClient.invalidateQueries({
        queryKey: ['credit-card-statements', account.id],
      });
      close();
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not confirm the statement payment. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onMarkWithoutReconciling = async (close: () => void) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await send('credit-card/confirm-statement-payment', {
        statementId: statement.id,
        cardTransactionId: null,
        counterpartTransactionId: null,
      });
      await queryClient.invalidateQueries({
        queryKey: ['credit-card-statements', account.id],
      });
      close();
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not mark the statement as paid. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderSlot = (
    slot: Slot,
    summary: {
      data?: TransactionSummary | null;
      isError: boolean;
      isLoading: boolean;
    },
    onPick: (id: string) => void,
    onClear: () => void,
  ) => {
    if (!loadedSuggestion || summary.isLoading) {
      return (
        <View style={{ alignItems: 'center', padding: 10 }}>
          <AnimatedLoading width={20} color={theme.pageTextSubdued} />
        </View>
      );
    }

    if (editingSlot === slot) {
      return (
        <TransactionPickerList
          accountId={slot === 'card' ? account.id : undefined}
          excludeAccountId={slot === 'counterpart' ? account.id : undefined}
          onSelect={id => {
            onPick(id);
            setEditingSlot(null);
          }}
        />
      );
    }

    if (summary.isError) {
      return (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.errorText }}>
            <Trans>Could not load transaction details.</Trans>
          </Text>
          <Button variant="bare" onPress={() => setEditingSlot(slot)}>
            <Trans>Search</Trans>
          </Button>
        </View>
      );
    }

    if (summary.data == null) {
      return (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.pageTextSubdued }}>
            {slot === 'card' ? (
              <Trans>No transaction found</Trans>
            ) : (
              <Trans>No matching transaction in another account</Trans>
            )}
          </Text>
          <Button variant="bare" onPress={() => setEditingSlot(slot)}>
            <Trans>Search</Trans>
          </Button>
        </View>
      );
    }

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ minWidth: 0 }}>
          <Text style={{ fontWeight: 600 }}>
            {summary.data.payeeName || t('(no payee)')}
          </Text>
          <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
            {monthUtils.format(summary.data.date, dateFormat)}
            {slot === 'counterpart' && summary.data.accountName
              ? ` · ${summary.data.accountName}`
              : ''}
            {' · '}
            <FinancialText>
              {format(summary.data.amount, 'financial')}
            </FinancialText>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Button variant="bare" onPress={() => setEditingSlot(slot)}>
            <Trans>Change</Trans>
          </Button>
          {slot === 'counterpart' && (
            <Button variant="bare" onPress={onClear}>
              <Trans>Remove</Trans>
            </Button>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal name="credit-card-confirm-payment">
      {({ state }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Confirm statement payment')} />}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ maxWidth: 480, gap: 14 }}>
            <Text style={{ color: theme.pageTextSubdued }}>
              <Trans>
                These transactions look like this statement's payment. Change
                either one if they're not right, then confirm to link them as a
                transfer and mark the statement paid.
              </Trans>
            </Text>

            <View style={{ gap: 4 }}>
              <Text style={{ fontWeight: 600, fontSize: '0.85em' }}>
                <Trans>Payment on the card</Trans>
              </Text>
              {renderSlot('card', cardSummary, setCardTransactionId, () =>
                setCardTransactionId(null),
              )}
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontWeight: 600, fontSize: '0.85em' }}>
                <Trans>Matching debit in another account</Trans>
              </Text>
              {renderSlot(
                'counterpart',
                counterpartSummary,
                setCounterpartTransactionId,
                () => setCounterpartTransactionId(null),
              )}
            </View>

            <ModalButtons>
              <Button
                onPress={() => onMarkWithoutReconciling(() => state.close())}
                isDisabled={isSaving}
              >
                <Trans>Mark paid without reconciling</Trans>
              </Button>
              <Button
                variant="primary"
                isDisabled={
                  isSaving ||
                  !loadedSuggestion ||
                  cardSummary.isLoading ||
                  counterpartSummary.isLoading ||
                  editingSlot != null ||
                  cardTransactionId == null ||
                  counterpartTransactionId == null ||
                  cardSummary.isError ||
                  counterpartSummary.isError ||
                  cardSummary.data == null ||
                  counterpartSummary.data == null
                }
                onPress={() => onConfirm(() => state.close())}
                style={{ marginLeft: 10 }}
              >
                <Trans>Confirm</Trans>
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
