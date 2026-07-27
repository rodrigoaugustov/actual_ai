import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { deleteBudget } from '#budgetfiles/budgetfilesSlice';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { useDispatch, useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

type DeleteFileModalProps = Extract<
  ModalType,
  { name: 'delete-budget' }
>['options'];

export function DeleteFileModal({ file }: DeleteFileModalProps) {
  const { t } = useTranslation();

  // If the state is "broken" that means it was created by another
  // user. The current user should be able to delete the local file,
  // but not the remote one
  const isCloudFile = 'cloudFileId' in file && file.state !== 'broken';
  const serverStatus = useSyncServerStatus();
  const dispatch = useDispatch();

  // Get current user info to check ownership
  const userData = useSelector(state => state.user.data);
  const currentUserId = userData?.userId;

  // Check if current user is the owner or has admin permissions
  const isOwner = 'owner' in file && file.owner === currentUserId;
  const isAdmin = userData?.permission === 'ADMIN';
  const canDeleteFromServer = isOwner || isAdmin;

  const [loadingState, setLoadingState] = useState<'cloud' | 'local' | null>(
    null,
  );

  return (
    <Modal name="delete-budget" containerProps={{ style: { width: 520 } }}>
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Delete {{budgetName}}?', { budgetName: file.name })}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View
            style={{
              gap: nossoCaderninho.space.lg,
              lineHeight: 1.45,
            }}
          >
            <Text style={{ color: theme.pageTextSubdued }}>
              <Trans>
                Choose where this budget should be removed. This action cannot
                be undone.
              </Trans>
            </Text>

            {isCloudFile &&
              (canDeleteFromServer ? (
                <View
                  style={{
                    gap: nossoCaderninho.space.md,
                    padding: nossoCaderninho.space.md,
                    border: `1px solid ${theme.tableBorder}`,
                    borderRadius: nossoCaderninho.radius.control,
                  }}
                >
                  <View style={{ gap: nossoCaderninho.space.xs }}>
                    <Text style={{ fontWeight: 650 }}>
                      <Trans>On every device</Trans>
                    </Text>
                    <Text
                      style={{
                        color: theme.pageTextSubdued,
                        fontSize: 11,
                      }}
                    >
                      <Trans>
                        Removes the synchronized budget and its copies from all
                        family devices.
                      </Trans>
                    </Text>
                  </View>
                  {serverStatus === 'online' ? (
                    <ButtonWithLoading
                      variant="primary"
                      isLoading={loadingState === 'cloud'}
                      style={{
                        backgroundColor: nossoCaderninho.color.limit,
                        alignSelf: 'flex-start',
                        border: 0,
                        minHeight: 36,
                        padding: '8px 14px',
                      }}
                      onPress={async () => {
                        setLoadingState('cloud');
                        await dispatch(
                          deleteBudget({
                            id: 'id' in file ? file.id : undefined,
                            cloudFileId: file.cloudFileId,
                          }),
                        );
                        setLoadingState(null);

                        state.close();
                      }}
                    >
                      <Trans>Delete on every device</Trans>
                    </ButtonWithLoading>
                  ) : (
                    <Button
                      isDisabled
                      style={{
                        alignSelf: 'flex-start',
                        minHeight: 36,
                        padding: '8px 14px',
                      }}
                    >
                      <Trans>Connect to delete on every device</Trans>
                    </Button>
                  )}
                </View>
              ) : (
                <View
                  style={{
                    padding: nossoCaderninho.space.md,
                    color: nossoCaderninho.color.graphite,
                    borderRadius: nossoCaderninho.radius.control,
                    backgroundColor: nossoCaderninho.color.signalSoft,
                  }}
                >
                  <Text>
                    <Trans>
                      This synchronized budget was shared with you. Only its
                      owner can remove it from every device.
                    </Trans>
                  </Text>
                </View>
              ))}

            {'id' in file && (
              <View
                style={{
                  gap: nossoCaderninho.space.md,
                  padding: nossoCaderninho.space.md,
                  border: `1px solid ${theme.tableBorder}`,
                  borderRadius: nossoCaderninho.radius.control,
                }}
              >
                <View style={{ gap: nossoCaderninho.space.xs }}>
                  <Text style={{ fontWeight: 650 }}>
                    {isCloudFile ? (
                      <Trans>Only on this device</Trans>
                    ) : (
                      <Trans>Local budget and backups</Trans>
                    )}
                  </Text>
                  <Text
                    style={{
                      color: theme.pageTextSubdued,
                      fontSize: 11,
                    }}
                  >
                    {isCloudFile ? (
                      <Trans>
                        Clears this device. The budget remains available to
                        download again.
                      </Trans>
                    ) : file.state === 'broken' ? (
                      <Trans>
                        This device has a copy created by another user. Only
                        this local copy can be removed.
                      </Trans>
                    ) : (
                      <Trans>
                        This budget exists only on this device. Removing it also
                        removes all of its backups.
                      </Trans>
                    )}
                  </Text>
                </View>

                {!isCloudFile && (
                  <Text
                    style={{
                      color: nossoCaderninho.color.limit,
                      fontSize: 11,
                      fontWeight: 650,
                    }}
                  >
                    <Trans>
                      There will be no synchronized copy to restore.
                    </Trans>
                  </Text>
                )}

                <ButtonWithLoading
                  variant={isCloudFile ? 'normal' : 'primary'}
                  isLoading={loadingState === 'local'}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: 36,
                    padding: '8px 14px',
                    ...(isCloudFile
                      ? {
                          color: nossoCaderninho.color.limit,
                          borderColor: nossoCaderninho.color.limit,
                        }
                      : {
                          border: 0,
                          backgroundColor: nossoCaderninho.color.limit,
                        }),
                  }}
                  onPress={async () => {
                    setLoadingState('local');
                    await dispatch(deleteBudget({ id: file.id }));
                    setLoadingState(null);

                    state.close();
                  }}
                >
                  {isCloudFile ? (
                    <Trans>Delete on this device</Trans>
                  ) : (
                    <Trans>Delete local budget</Trans>
                  )}
                </ButtonWithLoading>
              </View>
            )}

            <ModalButtons style={{ marginTop: nossoCaderninho.space.sm }}>
              <Button onPress={() => state.close()} style={{ minHeight: 36 }}>
                <Trans>Cancel</Trans>
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
