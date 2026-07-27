import React, { useLayoutEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { BuiltInProviders } from '#components/banksync/BuiltInProviders';
import { useBuiltInBankSyncProviders } from '#components/banksync/useBuiltInBankSyncProviders';
import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { useNavigate } from '#hooks/useNavigate';
import { pushModal, replaceModal } from '#modals/modalsSlice';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

type CreateAccountModalProps = Extract<
  ModalType,
  { name: 'add-account' }
>['options'];

export function CreateAccountModal({
  upgradingAccountId,
}: CreateAccountModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { providers, syncServerStatus, permissionWarning } =
    useBuiltInBankSyncProviders({ upgradingAccountId });

  const onCreateLocalAccount = () => {
    dispatch(pushModal({ modal: { name: 'add-local-account' } }));
  };

  const isUsingServer = syncServerStatus !== 'no-server';
  const shouldSkipToLocalAccount = !isUsingServer && upgradingAccountId == null;

  useLayoutEffect(() => {
    if (shouldSkipToLocalAccount) {
      dispatch(replaceModal({ modal: { name: 'add-local-account' } }));
    }
  }, [dispatch, shouldSkipToLocalAccount]);

  let title = t('Add account');

  if (upgradingAccountId != null) {
    title = t('Link account');
  }

  if (shouldSkipToLocalAccount) {
    return null;
  }

  return (
    <Modal name="add-account">
      {({ state }) => (
        <>
          <ModalHeader
            title={title}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View
            style={{
              maxWidth: upgradingAccountId == null ? 500 : 720,
              gap: nossoCaderninho.space.lg,
              color: theme.pageText,
            }}
          >
            {upgradingAccountId != null ? (
              <>
                <Text
                  style={{
                    color: theme.pageTextSubdued,
                    lineHeight: 1.45,
                  }}
                >
                  <Trans>
                    Choose a bank sync provider to connect this account.
                  </Trans>
                </Text>
                <BuiltInProviders
                  providers={providers}
                  syncServerStatus={syncServerStatus}
                  permissionWarning={permissionWarning}
                />
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: theme.pageTextSubdued,
                    lineHeight: 1.45,
                  }}
                >
                  <Trans>
                    Choose how this account will receive its transactions.
                  </Trans>
                </Text>

                <View
                  style={{
                    overflow: 'hidden',
                    border: `1px solid ${theme.tableBorder}`,
                    borderRadius: nossoCaderninho.radius.control,
                  }}
                >
                  <InitialFocus>
                    <Button
                      variant="bare"
                      style={{
                        width: '100%',
                        minHeight: 64,
                        alignItems: 'flex-start',
                        padding: nossoCaderninho.space.md,
                        borderRadius: 0,
                        backgroundColor: nossoCaderninho.color.partnershipSoft,
                        color: nossoCaderninho.color.graphite,
                      }}
                      onPress={onCreateLocalAccount}
                    >
                      <View style={{ alignItems: 'flex-start', gap: 2 }}>
                        <Text style={{ fontWeight: 650 }}>
                          <Trans>Create a local account</Trans>
                        </Text>
                        <Text
                          style={{
                            color: nossoCaderninho.color.graphiteSubdued,
                            textAlign: 'left',
                          }}
                        >
                          <Trans>
                            Enter transactions manually or import them from a
                            bank file.
                          </Trans>
                        </Text>
                      </View>
                    </Button>
                  </InitialFocus>
                  <Button
                    variant="bare"
                    onPress={() => {
                      state.close();
                      void navigate('/bank-sync');
                    }}
                    style={{
                      width: '100%',
                      minHeight: 64,
                      alignItems: 'flex-start',
                      padding: nossoCaderninho.space.md,
                      borderTop: `1px solid ${theme.tableBorder}`,
                      borderRadius: 0,
                      color: theme.pageText,
                    }}
                  >
                    <View style={{ alignItems: 'flex-start', gap: 2 }}>
                      <Text style={{ fontWeight: 650 }}>
                        <Trans>Set up bank sync</Trans>
                      </Text>
                      <Text
                        style={{
                          color: theme.pageTextSubdued,
                          textAlign: 'left',
                        }}
                      >
                        <Trans>
                          Connect a provider and keep future transactions coming
                          in automatically.
                        </Trans>
                      </Text>
                    </View>
                  </Button>
                </View>
              </>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
