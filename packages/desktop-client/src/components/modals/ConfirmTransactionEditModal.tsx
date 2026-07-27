// @ts-strict-ignore
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { Button } from '@actual-app/components/button';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { View } from '@actual-app/components/view';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import type { Modal as ModalType } from '#modals/modalsSlice';

type ConfirmTransactionEditModalProps = Extract<
  ModalType,
  { name: 'confirm-transaction-edit' }
>['options'];

export function ConfirmTransactionEditModal({
  onCancel,
  onConfirm,
  confirmReason,
}: ConfirmTransactionEditModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      name="confirm-transaction-edit"
      containerProps={{ style: { width: 460 } }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Review reconciled transaction')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ lineHeight: 1.5 }}>
            {confirmReason === 'batchDeleteWithReconciledTransfer' ? (
              <Block>
                <Trans>
                  This transfer has a linked transaction in another account that
                  is reconciled. Deleting it may bring that account's
                  reconciliation out of balance.
                </Trans>
              </Block>
            ) : confirmReason === 'batchDeleteWithReconciled' ? (
              <Block>
                <Trans>
                  Deleting reconciled transactions may bring your reconciliation
                  out of balance.
                </Trans>
              </Block>
            ) : confirmReason === 'batchEditWithReconciledTransfer' ? (
              <Block>
                <Trans>
                  This transfer has a linked transaction in another account that
                  is reconciled. Editing it may bring that account's
                  reconciliation out of balance.
                </Trans>
              </Block>
            ) : confirmReason === 'batchEditWithReconciled' ? (
              <Block>
                <Trans>
                  Editing reconciled transactions may bring your reconciliation
                  out of balance.
                </Trans>
              </Block>
            ) : confirmReason === 'editReconciled' ? (
              <Block>
                <Trans>
                  Saving your changes to this reconciled transaction may bring
                  your reconciliation out of balance.
                </Trans>
              </Block>
            ) : confirmReason === 'unlockReconciled' ? (
              <Block>
                <Trans>
                  Unlocking this transaction means you won't be warned about
                  changes that can impact your reconciled balance. (Changes to
                  amount, account, payee, etc).
                </Trans>
              </Block>
            ) : confirmReason === 'deleteReconciled' ? (
              <Block>
                <Trans>
                  Deleting reconciled transactions may bring your reconciliation
                  out of balance.
                </Trans>
              </Block>
            ) : (
              <Block>
                <Trans>Are you sure you want to edit this transaction?</Trans>
              </Block>
            )}
            <ModalButtons>
              <Button
                aria-label={t('Cancel')}
                style={{ minHeight: 36 }}
                onPress={() => {
                  state.close();
                  onCancel();
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <InitialFocus>
                <Button
                  aria-label={t('Confirm')}
                  variant="primary"
                  style={{ minWidth: 112, minHeight: 36 }}
                  onPress={() => {
                    state.close();
                    onConfirm();
                  }}
                >
                  <Trans>Confirm</Trans>
                </Button>
              </InitialFocus>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
