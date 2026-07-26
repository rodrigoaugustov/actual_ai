import React from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';

import { useServerURL } from '#components/ServerContext';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { Setting } from './UI';

export function EncryptionSettings() {
  const dispatch = useDispatch();
  const serverURL = useServerURL();
  const [encryptKeyId] = useMetadataPref('encryptKeyId');

  const missingCryptoAPI = !(window.crypto && crypto.subtle);

  function onChangeKey() {
    dispatch(
      pushModal({
        modal: { name: 'create-encryption-key', options: { recreate: true } },
      }),
    );
  }

  return encryptKeyId ? (
    <Setting
      primaryAction={
        <Button onPress={onChangeKey}>
          <Trans>Generate new key</Trans>
        </Button>
      }
    >
      <Text>
        <Text
          style={{
            color: nossoCaderninho.color.balance,
            fontWeight: 600,
          }}
        >
          <Trans>End-to-end Encryption is turned on.</Trans>
        </Text>{' '}
        <Trans>
          Your budget data is encrypted with a key that only you have before
          sending it out to the cloud. Local data remains unencrypted so if you
          forget your password you can re-encrypt it. Note: bank sync operations
          and secrets stored on the server are not covered by end-to-end
          encryption.
        </Trans>
      </Text>
    </Setting>
  ) : missingCryptoAPI ? (
    <Setting
      primaryAction={
        <Button isDisabled>
          <Trans>Enable encryption</Trans>
        </Button>
      }
    >
      <Text>
        <Trans>
          <strong>End-to-end encryption</strong> is not available when making an
          unencrypted connection to a remote server. You'll need to enable HTTPS
          on your server to use end-to-end encryption. This problem may also
          occur if your browser is too old to work with Nosso Caderninho.
        </Trans>
      </Text>
    </Setting>
  ) : serverURL ? (
    <Setting
      primaryAction={
        <Button
          onPress={() =>
            dispatch(
              pushModal({
                modal: { name: 'create-encryption-key', options: {} },
              }),
            )
          }
        >
          <Trans>Enable encryption</Trans>
        </Button>
      }
    >
      <Text>
        <Trans>
          <strong>End-to-end encryption</strong> is not enabled. Any data on the
          server is still protected by the server password, but it's not
          end-to-end encrypted which means the server owners have the ability to
          read it. If you want, you can use an additional password to encrypt
          your data on the server.
        </Trans>
      </Text>
    </Setting>
  ) : (
    <Setting
      primaryAction={
        <Button isDisabled>
          <Trans>Enable encryption</Trans>
        </Button>
      }
    >
      <Text>
        <Trans>
          <strong>End-to-end encryption</strong> is not available when running
          without a server. Budget files are always kept unencrypted locally,
          and encryption is only applied when sending data to a server.
        </Trans>
      </Text>
    </Setting>
  );
}
