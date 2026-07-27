import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, CSSProperties } from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import {
  SvgCloudCheck,
  SvgCloudDownload,
  SvgCog,
  SvgDotsHorizontalTriple,
  SvgFileDouble,
  SvgUser,
  SvgUserGroup,
} from '@actual-app/components/icons/v1';
import {
  SvgCloudUnknown,
  SvgKey,
  SvgRefreshArrow,
} from '@actual-app/components/icons/v2';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import {
  isElectron,
  isNonProductionEnvironment,
} from '@actual-app/core/shared/environment';
import type {
  File,
  LocalFile,
  RemoteFile,
  SyncableLocalFile,
  SyncedLocalFile,
} from '@actual-app/core/types/file';
import { css } from '@emotion/css';

import {
  closeAndDownloadBudget,
  closeAndLoadBudget,
  createBudget,
  downloadBudget,
  loadAllFiles,
  loadBudget,
} from '#budgetfiles/budgetfilesSlice';
import { useMultiuserEnabled } from '#components/ServerContext';
import { useInitialMount } from '#hooks/useInitialMount';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch, useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';
import { getUserData } from '#users/usersSlice';

import { ManagerSurface } from './ManagerSurface';

function getFileDescription(file: File, t: (key: string) => string) {
  if (file.state === 'unknown') {
    return t(
      'This is a cloud-based file but its state is unknown because you ' +
        'are offline.',
    );
  }

  if (file.encryptKeyId) {
    if (file.hasKey) {
      return t('This file is encrypted and you have key to access it.');
    }
    return t('This file is encrypted and you do not have the key for it.');
  }

  return null;
}

function isLocalFile(file: File): file is LocalFile {
  return file.state === 'local';
}

type BudgetFileMenuProps = {
  onDelete: () => void;
  onClose: () => void;
  onDuplicate?: () => void;
};

function BudgetFileMenu({
  onDelete,
  onClose,
  onDuplicate,
}: BudgetFileMenuProps) {
  function onMenuSelect(type: string) {
    onClose();

    switch (type) {
      case 'delete':
        onDelete();
        break;
      case 'duplicate':
        if (onDuplicate) onDuplicate();
        break;
      default:
    }
  }

  const { t } = useTranslation();

  const items = [
    ...(onDuplicate ? [{ name: 'duplicate', text: t('Duplicate') }] : []),
    { name: 'delete', text: t('Delete') },
  ];

  return <Menu onMenuSelect={onMenuSelect} items={items} />;
}

type BudgetFileMenuButtonProps = {
  onDelete: () => void;
  onDuplicate?: () => void;
};

function BudgetFileMenuButton({
  onDelete,
  onDuplicate,
}: BudgetFileMenuButtonProps) {
  const { t } = useTranslation();

  const triggerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View>
      <Button
        ref={triggerRef}
        variant="bare"
        aria-label={t('Menu')}
        onPress={() => {
          setMenuOpen(true);
        }}
      >
        <SvgDotsHorizontalTriple style={{ width: 16, height: 16 }} />
      </Button>

      <Popover
        triggerRef={triggerRef}
        isOpen={menuOpen}
        onOpenChange={() => setMenuOpen(false)}
      >
        <BudgetFileMenu
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
          onDuplicate={onDuplicate}
        />
      </Popover>
    </View>
  );
}

type BudgetFileStateProps = {
  file: File;
  currentUserId: string;
};

function BudgetFileState({ file, currentUserId }: BudgetFileStateProps) {
  const { t } = useTranslation();
  const multiuserEnabled = useMultiuserEnabled();

  let Icon;
  let status;
  let color: string = nossoCaderninho.color.balance;
  let ownerName = null;

  const getOwnerDisplayName = useCallback(() => {
    if ('usersWithAccess' in file) {
      const userFound = file.usersWithAccess?.find(f => f.owner);

      if (userFound?.userName === '') {
        return 'Server';
      }

      return userFound?.displayName ?? userFound?.userName ?? t('Unassigned');
    }

    return t('Unknown');
  }, [file, t]);

  switch (file.state) {
    case 'unknown':
      Icon = SvgCloudUnknown;
      status = t('Network unavailable');
      color = nossoCaderninho.color.graphiteSubdued;
      ownerName = t('Unknown');
      break;
    case 'remote':
      Icon = SvgCloudDownload;
      status = t('Available for download');
      color = nossoCaderninho.color.partnership;
      ownerName = getOwnerDisplayName();
      break;
    case 'local':
      Icon = SvgFileDouble;
      status = t('Local');
      color = nossoCaderninho.color.balance;
      ownerName = t('You');
      break;
    case 'broken':
      Icon = SvgFileDouble;
      status = t('Local');
      color = nossoCaderninho.color.commitment;
      ownerName = t('Unknown');
      break;
    default:
      Icon = SvgCloudCheck;
      status = t('Syncing');
      color = nossoCaderninho.color.balance;
      ownerName = getOwnerDisplayName();
      break;
  }

  const showOwnerContent = multiuserEnabled && file.owner !== currentUserId;

  return (
    <View style={{ width: '100%', gap: 4 }}>
      <View style={{ color, alignItems: 'center', flexDirection: 'row' }}>
        <Icon
          style={{
            width: 15,
            height: 15,
            color: 'currentColor',
          }}
        />

        <Text style={{ marginLeft: 6, fontSize: 12 }}>{status}</Text>
      </View>

      <View style={{ flexDirection: 'row', width: '100%' }}>
        {showOwnerContent && (
          <View style={{ flexDirection: 'row' }}>
            <Text
              style={{
                ...styles.verySmallText,
                color: nossoCaderninho.color.graphiteSubdued,
              }}
            >
              <Trans>Owner:</Trans>
            </Text>
            <Text
              style={{
                ...styles.verySmallText,
                color: nossoCaderninho.color.graphiteSubdued,
                paddingLeft: 5,
              }}
            >
              {ownerName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type BudgetFileListItemProps = ComponentPropsWithoutRef<
  typeof GridListItem<File>
> & {
  quickSwitchMode: boolean;
  onSelect: (file: File) => Promise<void>;
  onDelete: (file: File) => void;
  onDuplicate: (file: File) => void;
  currentUserId: string;
};

function BudgetFileListItem({
  quickSwitchMode,
  onSelect,
  onDelete,
  onDuplicate,
  currentUserId,
  ...props
}: BudgetFileListItemProps) {
  const { t } = useTranslation();
  const multiuserEnabled = useMultiuserEnabled();

  const selecting = useRef(false);

  async function _onSelect(file: File) {
    // Never allow selecting the file while uploading/downloading, and
    // make sure to never allow duplicate clicks
    if (!selecting.current) {
      selecting.current = true;
      await onSelect(file);
      selecting.current = false;
    }
  }

  const { value: file } = props;

  if (!file) {
    return null;
  }

  return (
    <GridListItem
      textValue={file.name}
      onAction={() => _onSelect(file)}
      {...props}
    >
      <View className={budgetRowClass}>
        <View
          title={getFileDescription(file, t) || ''}
          style={{ alignItems: 'flex-start', width: '100%' }}
        >
          <View
            style={{
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Text
              style={{
                minWidth: 0,
                overflow: 'hidden',
                fontSize: 14,
                fontWeight: 650,
                lineHeight: 1.3,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.name}
            </Text>
            {multiuserEnabled && 'cloudFileId' in file && (
              <UserAccessForFile
                fileId={file.cloudFileId}
                currentUserId={currentUserId}
              />
            )}
          </View>

          <BudgetFileState file={file} currentUserId={currentUserId} />
        </View>

        <View
          style={{
            flex: '0 0 auto',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {file.encryptKeyId && (
            <SvgKey
              style={{
                width: 13,
                height: 13,
                marginRight: 8,
                color: file.hasKey
                  ? nossoCaderninho.color.partnership
                  : nossoCaderninho.color.graphiteSubdued,
              }}
            />
          )}

          {!quickSwitchMode && (
            <BudgetFileMenuButton
              onDelete={() => onDelete(file)}
              onDuplicate={'id' in file ? () => onDuplicate(file) : undefined}
            />
          )}
        </View>
      </View>
    </GridListItem>
  );
}

type BudgetFileListProps = {
  files: File[];
  quickSwitchMode: boolean;
  onSelect: (file: File) => Promise<void>;
  onDelete: (file: File) => void;
  onDuplicate: (file: File) => void;
  currentUserId: string;
};

function BudgetFileList({
  files,
  quickSwitchMode,
  onSelect,
  onDelete,
  onDuplicate,
  currentUserId,
}: BudgetFileListProps) {
  const { t } = useTranslation();
  return (
    <GridList
      aria-label={t('Budget files')}
      items={files}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
      }}
      renderEmptyState={() => (
        <Text
          style={{
            padding: 24,
            fontSize: 13,
            textAlign: 'left',
            color: nossoCaderninho.color.graphiteSubdued,
          }}
        >
          <Trans>No other caderninhos are available on this device.</Trans>
        </Text>
      )}
    >
      {file => {
        const id = isLocalFile(file) ? file.id : file.cloudFileId;
        return (
          <BudgetFileListItem
            key={id}
            id={id}
            value={file}
            currentUserId={currentUserId}
            quickSwitchMode={quickSwitchMode}
            onSelect={onSelect}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        );
      }}
    </GridList>
  );
}

type RefreshButtonProps = {
  style?: CSSProperties;
  onRefresh: () => void;
};

function RefreshButton({ style, onRefresh }: RefreshButtonProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);

  async function _onRefresh() {
    setLoading(true);
    onRefresh();
    setLoading(false);
  }

  const Icon = loading ? AnimatedLoading : SvgRefreshArrow;

  return (
    <Button
      variant="bare"
      aria-label={t('Refresh')}
      style={{ padding: 10, ...style }}
      onPress={_onRefresh}
    >
      <Icon style={{ width: 18, height: 18 }} />
    </Button>
  );
}

type SettingsButtonProps = {
  onOpenSettings: () => void;
};

function SettingsButton({ onOpenSettings }: SettingsButtonProps) {
  const { t } = useTranslation();

  return (
    <View>
      <Button
        variant="bare"
        aria-label={t('Home settings')}
        onPress={() => {
          onOpenSettings();
        }}
        style={{ padding: 10 }}
      >
        <SvgCog style={{ width: 18, height: 18 }} />
      </Button>
    </View>
  );
}

type BudgetFileSelectionHeaderProps = {
  quickSwitchMode: boolean;
  onRefresh?: () => void;
  onOpenSettings: () => void;
};

function BudgetFileSelectionHeader({
  quickSwitchMode,
  onRefresh,
  onOpenSettings,
}: BudgetFileSelectionHeaderProps) {
  return (
    <div className={selectionHeaderClass}>
      <div className={selectionHeadingClass}>
        <h2>
          {quickSwitchMode ? (
            <Trans>Choose another caderninho</Trans>
          ) : (
            <Trans>Caderninhos from this home</Trans>
          )}
        </h2>
        {!quickSwitchMode && (
          <p>
            <Trans>
              Open a budget available on this device or download one from your
              connected home.
            </Trans>
          </p>
        )}
      </div>
      {!quickSwitchMode && (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {onRefresh && <RefreshButton onRefresh={onRefresh} />}
          {isElectron() && <SettingsButton onOpenSettings={onOpenSettings} />}
        </View>
      )}
    </div>
  );
}

type BudgetFileSelectionProps = {
  showHeader?: boolean;
  quickSwitchMode?: boolean;
};

export function BudgetFileSelection({
  showHeader = true,
  quickSwitchMode = false,
}: BudgetFileSelectionProps) {
  const dispatch = useDispatch();
  const allFiles = useSelector(state => state.budgetfiles.allFiles || []);
  const multiuserEnabled = useMultiuserEnabled();
  const [id] = useMetadataPref('id');
  const [currentUserId, setCurrentUserId] = useState('');
  const userData = useSelector(state => state.user.data);
  const serverStatus = useSyncServerStatus();

  const fetchUsers = useCallback(async () => {
    try {
      setCurrentUserId(userData?.userId ?? '');
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, [userData?.userId]);

  useEffect(() => {
    if (multiuserEnabled && !userData?.offline) {
      void fetchUsers();
    }
  }, [multiuserEnabled, userData?.offline, fetchUsers]);

  // Remote files do not have the 'id' field
  function isNonRemoteFile(
    file: File,
  ): file is LocalFile | SyncableLocalFile | SyncedLocalFile {
    return file.state !== 'remote';
  }

  // Filter out the open file
  const files = id
    ? allFiles.filter(file => !isNonRemoteFile(file) || file.id !== id)
    : allFiles;

  const [creating, setCreating] = useState(false);
  const { isNarrowWidth } = useResponsive();
  const narrowButtonStyle = isNarrowWidth
    ? {
        height: styles.mobileMinHeight,
      }
    : {};

  const onCreate = ({ testMode = false } = {}) => {
    if (!creating) {
      setCreating(true);
      void dispatch(createBudget({ testMode }));
    }
  };

  const refresh = () => {
    void dispatch(getUserData());
    void dispatch(loadAllFiles());
  };

  const initialMount = useInitialMount();
  if (initialMount && quickSwitchMode) {
    refresh();
  }

  const onSelect = async (file: File): Promise<void> => {
    const isRemoteFile = file.state === 'remote';

    if (!id) {
      if (isRemoteFile) {
        await dispatch(downloadBudget({ cloudFileId: file.cloudFileId }));
      } else {
        await dispatch(loadBudget({ id: file.id }));
      }
    } else if (!isRemoteFile && file.id !== id) {
      await dispatch(closeAndLoadBudget({ fileId: file.id }));
    } else if (isRemoteFile) {
      await dispatch(closeAndDownloadBudget({ cloudFileId: file.cloudFileId }));
    }
  };

  const selectionContent = (
    <>
      {showHeader && (
        <BudgetFileSelectionHeader
          quickSwitchMode={quickSwitchMode}
          onRefresh={serverStatus === 'online' ? refresh : undefined}
          onOpenSettings={() =>
            dispatch(pushModal({ modal: { name: 'files-settings' } }))
          }
        />
      )}
      <BudgetFileList
        files={files}
        currentUserId={currentUserId}
        quickSwitchMode={quickSwitchMode}
        onSelect={onSelect}
        onDelete={(file: File) =>
          dispatch(
            pushModal({ modal: { name: 'delete-budget', options: { file } } }),
          )
        }
        onDuplicate={(file: File) => {
          if (file && 'id' in file) {
            dispatch(
              pushModal({
                modal: {
                  name: 'duplicate-budget',
                  options: { file, managePage: true },
                },
              }),
            );
          } else {
            console.error(
              'Attempted to duplicate a cloud file - only local files are supported. Cloud file:',
              file,
            );
          }
        }}
      />
      {!quickSwitchMode && (
        <div className={selectionActionsClass}>
          <Button
            variant="bare"
            style={{
              ...narrowButtonStyle,
              color: nossoCaderninho.color.partnership,
            }}
            onPress={() => {
              dispatch(pushModal({ modal: { name: 'import' } }));
            }}
          >
            <Trans>Import budget</Trans>
          </Button>

          <Button
            variant="primary"
            onPress={() => onCreate()}
            style={{
              ...narrowButtonStyle,
              backgroundColor: nossoCaderninho.color.partnershipSurface,
            }}
          >
            <Trans>Start a new caderninho</Trans>
          </Button>

          {isNonProductionEnvironment() && (
            <Button
              variant="primary"
              onPress={() => onCreate({ testMode: true })}
              style={{
                ...narrowButtonStyle,
                backgroundColor: nossoCaderninho.color.partnershipSurface,
              }}
            >
              <Trans>Create test caderninho</Trans>
            </Button>
          )}
        </div>
      )}
    </>
  );

  if (quickSwitchMode) {
    return <View className={quickSwitchClass}>{selectionContent}</View>;
  }

  return (
    <ManagerSurface
      chapter={<Trans>Our home</Trans>}
      title={<Trans>Choose a caderninho to continue.</Trans>}
      description={
        <Trans>
          Local and shared budgets stay together here, with their availability
          clearly indicated.
        </Trans>
      }
      status={
        serverStatus === 'online' ? (
          <Trans>Connected home available</Trans>
        ) : (
          <Trans>Local budgets remain available offline</Trans>
        )
      }
    >
      {selectionContent}
    </ManagerSurface>
  );
}

const budgetRowClass = css({
  display: 'flex',
  minWidth: 0,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: nossoCaderninho.space.md,
  minHeight: 66,
  padding: '12px 4px',
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  cursor: 'pointer',
  transition: `background-color ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '[data-focused] &': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const selectionHeaderClass = css({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.md,
  marginBottom: nossoCaderninho.space.lg,
});

const selectionHeadingClass = css({
  display: 'grid',
  gap: nossoCaderninho.space.sm,
  minWidth: 0,
  h2: {
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 20,
    fontWeight: 720,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  p: {
    maxWidth: '58ch',
    margin: 0,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 13,
    lineHeight: 1.45,
  },
});

const selectionActionsClass = css({
  display: 'flex',
  flexWrap: 'wrap-reverse',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  minHeight: 39,
  marginTop: nossoCaderninho.space.lg,
  '@media (max-width: 520px)': {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    button: {
      width: '100%',
    },
  },
});

const quickSwitchClass = css({
  display: 'flex',
  width: 'min(560px, 100vw)',
  maxHeight: 'min(620px, calc(100dvh - 40px))',
  flexDirection: 'column',
  padding: nossoCaderninho.space.xl,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  fontFamily: nossoCaderninho.font.family,
});

type UserAccessForFileProps = {
  fileId: string;
  currentUserId: string;
};

function UserAccessForFile({ fileId, currentUserId }: UserAccessForFileProps) {
  const { t } = useTranslation();

  const allFiles = useSelector(state => state.budgetfiles.allFiles || []);
  const remoteFiles = allFiles.filter(
    f => f.state === 'remote' || f.state === 'synced' || f.state === 'detached',
  ) as (SyncedLocalFile | RemoteFile)[];
  const currentFile = remoteFiles.find(f => f.cloudFileId === fileId);
  const multiuserEnabled = useMultiuserEnabled();

  let usersAccess = currentFile?.usersWithAccess ?? [];
  usersAccess = usersAccess?.filter(user => user.userName !== '') ?? [];

  const sortedUsersAccess = [...usersAccess].sort((a, b) => {
    const textA =
      a.userId === currentUserId ? t('You') : (a.displayName ?? a.userName);
    const textB =
      b.userId === currentUserId ? t('You') : (b.displayName ?? b.userName);
    return textA.localeCompare(textB);
  });

  return (
    <View>
      {multiuserEnabled &&
        usersAccess.length > 0 &&
        !(sortedUsersAccess.length === 1 && sortedUsersAccess[0].owner) && (
          <View
            style={{
              marginLeft: '5px',
              alignSelf: 'center',
            }}
          >
            <Tooltip
              content={
                <View
                  style={{
                    margin: 5,
                  }}
                >
                  <Text
                    style={{
                      ...styles.altMenuHeaderText,
                      ...styles.verySmallText,
                      color: theme.pageTextLight,
                    }}
                  >
                    File shared with:
                  </Text>
                  <View
                    style={{
                      padding: 0,
                    }}
                  >
                    {sortedUsersAccess.map(user => (
                      <View key={user.userId} style={{ flexDirection: 'row' }}>
                        <SvgUser
                          style={{
                            width: 10,
                            height: 10,
                            opacity: 0.7,
                            marginTop: 3,
                            marginRight: 5,
                          }}
                        />
                        <View
                          style={{
                            ...styles.verySmallText,
                            color: theme.pageTextLight,
                            margin: 0,
                            listStylePosition: 'inside',
                          }}
                        >
                          {user.userId === currentUserId
                            ? t('You')
                            : (user.displayName ?? user.userName)}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              }
              placement="bottom end"
            >
              <SvgUserGroup
                style={{
                  width: 15,
                  height: 15,
                  alignSelf: 'flex-end',
                  opacity: 0.7,
                }}
              />
            </Tooltip>
          </View>
        )}
    </View>
  );
}
