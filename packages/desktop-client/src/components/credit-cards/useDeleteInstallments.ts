import { useTranslation } from 'react-i18next';

import { send } from '@actual-app/core/platform/client/connection';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { useQueryClient } from '@tanstack/react-query';

import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { transactionQueries } from '#transactions';

type DeleteInstallmentsSuccess = () => void;

export function useDeleteInstallments() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return function confirmDeleteInstallments(
    transaction: TransactionEntity,
    onSuccess?: DeleteInstallmentsSuccess,
  ) {
    const groupId = transaction.installment_group;
    if (!groupId) {
      return;
    }

    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            title: t('Undo installment purchase'),
            message: t(
              'This will delete all {{count}} installments in this purchase. Continue?',
              { count: transaction.installment_total ?? 1 },
            ),
            confirmLabel: t('Undo installments'),
            onConfirm: () => {
              void (async () => {
                try {
                  await send('credit-card/delete-installments', { groupId });
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: transactionQueries.all(),
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ['credit-card-statements', transaction.account],
                    }),
                  ]);
                  dispatch(
                    addNotification({
                      notification: {
                        type: 'message',
                        message: t('Installment purchase deleted.'),
                      },
                    }),
                  );
                  onSuccess?.();
                } catch {
                  dispatch(
                    addNotification({
                      notification: {
                        type: 'error',
                        message: t(
                          'Could not undo the installment purchase. Check your connection and try again.',
                        ),
                      },
                    }),
                  );
                }
              })();
            },
          },
        },
      }),
    );
  };
}
