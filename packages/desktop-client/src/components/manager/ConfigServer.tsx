// @ts-strict-ignore
import React, { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { BigInput } from '@actual-app/components/input';
import { Label } from '@actual-app/components/label';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { isElectron } from '@actual-app/core/shared/environment';
import { css } from '@emotion/css';

import { Link } from '#components/common/Link';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { useServerURL, useSetServerURL } from '#components/ServerContext';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useNavigate } from '#hooks/useNavigate';
import { saveGlobalPrefs } from '#prefs/prefsSlice';
import { useDispatch, useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';
import { loggedIn, signOut } from '#users/usersSlice';

import { ManagerSurface } from './ManagerSurface';
import { Title } from './subscribe/common';

export function ElectronServerConfig({
  onDoNotUseServer,
  onSetServerConfigView,
}: {
  onDoNotUseServer: () => void;
  onSetServerConfigView: (view: 'internal' | 'external') => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setServerUrl = useSetServerURL();
  const currentUrl = useServerURL();
  const dispatch = useDispatch();

  const [syncServerConfig, setSyncServerConfig] =
    useGlobalPref('syncServerConfig');

  const [electronServerPort, setElectronServerPort] = useState(
    syncServerConfig?.port || 5007,
  );
  const [configError, setConfigError] = useState<string | null>(null);

  const canShowExternalServerConfig = !syncServerConfig?.port && !currentUrl;
  const hasInternalServerConfig = syncServerConfig?.port;

  const [startingSyncServer, setStartingSyncServer] = useState(false);

  const onConfigureSyncServer = async () => {
    if (startingSyncServer) {
      return; // Prevent multiple clicks
    }

    if (
      isNaN(electronServerPort) ||
      electronServerPort <= 0 ||
      electronServerPort > 65535
    ) {
      setConfigError(t('Ports must be within range 1 - 65535'));
      return;
    }

    try {
      setConfigError(null);
      setStartingSyncServer(true);
      // Ensure config is saved before starting the server
      await dispatch(
        saveGlobalPrefs({
          prefs: {
            syncServerConfig: {
              ...syncServerConfig,
              port: electronServerPort,
              autoStart: true,
            },
          },
        }),
      ).unwrap();

      await window.globalThis.Actual.stopSyncServer();
      await window.globalThis.Actual.startSyncServer();
      setStartingSyncServer(false);
      void initElectronSyncServerRunningStatus();
      await setServerUrl(`http://localhost:${electronServerPort}`);
      void navigate('/');
    } catch (error) {
      setStartingSyncServer(false);
      setConfigError(t('Failed to configure sync server'));
      console.error('Failed to configure sync server:', error);
    }
  };

  const [electronSyncServerRunning, setElectronSyncServerRunning] =
    useState(false);

  const initElectronSyncServerRunningStatus = async () => {
    setElectronSyncServerRunning(
      await window.globalThis.Actual.isSyncServerRunning(),
    );
  };

  useEffect(() => {
    void initElectronSyncServerRunningStatus();
  }, []);

  async function dontUseSyncServer() {
    setSyncServerConfig(null);

    if (electronSyncServerRunning) {
      await window.globalThis.Actual.stopSyncServer();
    }

    onDoNotUseServer();
  }

  return (
    <>
      <Title level={2} text={t('Set up sync')} />
      <View
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            color: nossoCaderninho.color.graphite,
            lineHeight: 1.5,
          }}
        >
          <Trans>
            Keep the same caderninho up to date across your devices. This device
            can host the connection locally when Nosso Caderninho is open.
          </Trans>
        </Text>

        {configError && (
          <Text style={{ color: nossoCaderninho.color.limit, marginTop: 10 }}>
            {configError}
          </Text>
        )}

        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'column', gap: 5, flex: 1 }}>
            <Label title={t('Domain')} style={{ textAlign: 'left' }} />
            <BigInput
              value="localhost"
              disabled
              type="text"
              className={css({
                '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                  WebkitAppearance: 'none',
                  margin: 0,
                },
              })}
            />
          </View>

          <View style={{ flexDirection: 'column', gap: 5 }}>
            <Label
              title={t('Port')}
              style={{ textAlign: 'left', width: '7ch' }}
            />
            <BigInput
              name="port"
              value={String(electronServerPort)}
              aria-label={t('Port')}
              type="number"
              className={css({
                '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                  WebkitAppearance: 'none',
                  margin: 0,
                },
                width: '7ch',
                textAlign: 'center',
              })}
              autoFocus
              maxLength={5}
              onChange={event =>
                setElectronServerPort(Number(event.target.value))
              }
            />
          </View>

          <View
            style={{
              flexDirection: 'column',
              gap: 5,
              justifyContent: 'end',
            }}
          >
            <Label title={t('')} style={{ textAlign: 'left', width: '7ch' }} />
            {!electronSyncServerRunning ? (
              <ButtonWithLoading
                variant="primary"
                style={{ padding: 10, width: '8ch' }}
                onPress={onConfigureSyncServer}
                isLoading={startingSyncServer}
              >
                <Trans>Start</Trans>
              </ButtonWithLoading>
            ) : (
              <ButtonWithLoading
                variant="primary"
                style={{ padding: 10, width: '8ch' }}
                onPress={onConfigureSyncServer}
                isLoading={startingSyncServer}
              >
                <Trans>Save</Trans>
              </ButtonWithLoading>
            )}
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: 20,
          gap: 15,
          flexFlow: 'row wrap',
          justifyContent: 'center',
        }}
      >
        {hasInternalServerConfig && (
          <Button
            variant="bare"
            style={{ color: nossoCaderninho.color.graphiteSubdued, margin: 5 }}
            onPress={() => navigate(-1)}
          >
            <Trans>Cancel</Trans>
          </Button>
        )}
        <Button
          variant="bare"
          style={{ color: nossoCaderninho.color.graphiteSubdued, margin: 5 }}
          onPress={dontUseSyncServer}
        >
          <Trans>Continue only on this device</Trans>
        </Button>
        {canShowExternalServerConfig && (
          <Button
            variant="bare"
            style={{ color: nossoCaderninho.color.partnership, margin: 5 }}
            onPress={() => onSetServerConfigView('external')}
          >
            <Trans>Use another sync address</Trans>
          </Button>
        )}
      </View>
    </>
  );
}

export function ConfigServer() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const userData = useSelector(state => state.user.data);
  const [url, setUrl] = useState('');
  const currentUrl = useServerURL();
  const setServerUrl = useSetServerURL();
  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restartElectronServer = useCallback(() => {
    globalThis.window.Actual.restartElectronServer();
    setError(null);
  }, []);

  const [_serverSelfSignedCert, setServerSelfSignedCert] = useGlobalPref(
    'serverSelfSignedCert',
    restartElectronServer,
  );

  function getErrorMessage(error: string) {
    switch (error) {
      case 'network-failure':
        return t(
          'Connection failed. If you use a self-signed certificate or were recently offline, try refreshing the page. Otherwise ensure you have HTTPS set up properly.',
        );
      default:
        return t(
          'This address does not appear to be a Nosso Caderninho sync service. Check the address and try again.',
        );
    }
  }

  async function onSubmit() {
    if (url === null || url === '' || loading) {
      return;
    }

    setError(null);
    setLoading(true);

    let httpUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      httpUrl = 'https://' + url;
    }

    const { error } = await setServerUrl(httpUrl);
    setUrl(httpUrl);

    if (error) {
      setLoading(false);
      setError(error);
    } else {
      setLoading(false);
      await dispatch(signOut());
      void navigate('/');
    }
  }

  function onSameDomain() {
    setUrl(window.location.origin);
  }

  async function onSelectSelfSignedCertificate() {
    const selfSignedCertificateLocation = await window.Actual.openFileDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Self Signed Certificate',
          extensions: ['crt', 'pem'],
        },
      ],
    });

    if (selfSignedCertificateLocation) {
      setServerSelfSignedCert(selfSignedCertificateLocation[0]);
    }
  }

  async function onSkip() {
    await setServerUrl(null);
    await dispatch(loggedIn());
    void navigate('/');
  }

  const [syncServerConfig] = useGlobalPref('syncServerConfig');

  const hasExternalServerConfig = !syncServerConfig?.port && !!currentUrl;

  const [serverConfigView, onSetServerConfigView] = useState<
    'internal' | 'external'
  >(() => {
    if (isElectron() && !hasExternalServerConfig) {
      return 'internal';
    }

    return 'external';
  });

  return (
    <ManagerSurface
      chapter={<Trans>Connection of our home</Trans>}
      title={<Trans>The same caderninho on every device.</Trans>}
      description={
        <Trans>
          Connect this device to the shared home or continue with budgets saved
          locally.
        </Trans>
      }
      status={
        currentUrl ? (
          <Trans>This device has a sync address</Trans>
        ) : (
          <Trans>Sync is optional</Trans>
        )
      }
    >
      {(userData || currentUrl) && (
        <MobileBackButton
          onPress={() =>
            location.key !== 'default' ? navigate(-1) : navigate('/')
          }
          style={{
            alignSelf: 'flex-start',
            color: nossoCaderninho.color.partnership,
            margin: 0,
            marginBottom: 16,
          }}
        />
      )}
      {serverConfigView === 'internal' && (
        <ElectronServerConfig
          onDoNotUseServer={onSkip}
          onSetServerConfigView={onSetServerConfigView}
        />
      )}
      {serverConfigView === 'external' && (
        <>
          <Title level={2} text={t('Connect this device')} />
          <Text
            style={{
              fontSize: 16,
              color: nossoCaderninho.color.graphite,
              lineHeight: 1.5,
            }}
          >
            {currentUrl ? (
              <Trans>
                Existing sessions will be closed before you enter the home
                available at this address.
              </Trans>
            ) : (
              <Trans>
                A sync connection keeps the household budget up to date across
                devices. It is optional: your local budgets continue to work on
                this device.
              </Trans>
            )}
          </Text>
          {!currentUrl && (
            <Text
              style={{
                fontSize: 16,
                color: nossoCaderninho.color.graphiteSubdued,
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              <Trans>
                Enter the sync address already used by your home. You can also
                continue locally and connect later in Home settings.
              </Trans>
            </Text>
          )}
          {error && (
            <>
              <Text
                style={{
                  marginTop: 20,
                  color: nossoCaderninho.color.limit,
                  borderRadius: 4,
                  fontSize: 15,
                }}
              >
                {getErrorMessage(error)}
              </Text>
              {isElectron() && (
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    marginTop: 20,
                  }}
                >
                  <Text
                    style={{
                      color: nossoCaderninho.color.limit,
                      borderRadius: 4,
                      fontSize: 15,
                    }}
                  >
                    <Trans>
                      If the server is using a self-signed certificate{' '}
                      <Link
                        variant="text"
                        style={{ fontSize: 15 }}
                        onClick={onSelectSelfSignedCertificate}
                      >
                        select it here
                      </Link>
                      .
                    </Trans>
                  </Text>
                </View>
              )}
            </>
          )}
          <View className={connectionFormClass}>
            <BigInput
              autoFocus
              className={connectedInputClass}
              placeholder={t('https://example.com')}
              value={url || ''}
              onChangeValue={setUrl}
              style={{
                minWidth: 0,
                color: nossoCaderninho.color.graphite,
                backgroundColor: nossoCaderninho.color.plate,
                borderColor: nossoCaderninho.color.rail,
              }}
              onEnter={onSubmit}
            />
            <ButtonWithLoading
              variant="primary"
              isLoading={loading}
              style={{
                fontSize: 15,
                color: nossoCaderninho.color.navText,
                backgroundColor: nossoCaderninho.color.partnershipSurface,
                borderColor: nossoCaderninho.color.partnership,
                boxShadow: 'none',
              }}
              onPress={onSubmit}
            >
              <Trans>Connect</Trans>
            </ButtonWithLoading>
          </View>
          <View
            style={{
              alignItems: 'center',
              gap: 15,
              marginTop: 30,
            }}
          >
            {currentUrl ? (
              <Button
                variant="bare"
                style={{ color: nossoCaderninho.color.partnership }}
                onPress={onSkip}
              >
                <Trans>Disconnect this device</Trans>
              </Button>
            ) : (
              <>
                {!isElectron() && (
                  <Button
                    variant="bare"
                    style={{ color: nossoCaderninho.color.partnership }}
                    onPress={onSameDomain}
                  >
                    <Trans>Use this site's address</Trans>
                  </Button>
                )}
                {!userData && (
                  <Button
                    variant="bare"
                    style={{ color: nossoCaderninho.color.partnership }}
                    onPress={onSkip}
                  >
                    <Trans>Continue only on this device</Trans>
                  </Button>
                )}
              </>
            )}
          </View>
        </>
      )}
    </ManagerSurface>
  );
}

const connectionFormClass = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  marginTop: 30,
  '@media (max-width: 460px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    button: {
      width: '100%',
      minHeight: 44,
    },
  },
});

const connectedInputClass = css({
  boxShadow: 'none !important',
  '&::placeholder': {
    color: `${nossoCaderninho.color.graphiteSubdued} !important`,
    opacity: 1,
  },
});
