// @ts-strict-ignore
import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Paragraph } from '@actual-app/components/paragraph';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { createBudget } from '#budgetfiles/budgetfilesSlice';
import { ManagerSurface } from '#components/manager/ManagerSurface';
import { useRefreshLoginMethods } from '#components/ServerContext';
import { useNavigate } from '#hooks/useNavigate';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { Title, useBootstrapped } from './common';
import { ConfirmPasswordForm } from './ConfirmPasswordForm';

export function Bootstrap() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [error, setError] = useState(null);
  const refreshLoginMethods = useRefreshLoginMethods();

  const { checked } = useBootstrapped();
  const navigate = useNavigate();

  function getErrorMessage(error) {
    switch (error) {
      case 'invalid-password':
        return t('Password cannot be empty');
      case 'password-match':
        return t('Passwords do not match');
      case 'network-failure':
        return t('Unable to contact the server');
      case 'missing-issuer':
        return t('OpenID server cannot be empty');
      case 'missing-client-id':
        return t('Client ID cannot be empty');
      case 'missing-client-secret':
        return t('Client secret cannot be empty');
      default:
        return t(`An unknown error occurred: {{error}}`, { error });
    }
  }

  async function onSetPassword(password) {
    setError(null);
    const { error } = await send('subscribe-bootstrap', { password });

    if (error) {
      setError(error);
    } else {
      await refreshLoginMethods();
      void navigate('/login');
    }
  }

  async function onDemo() {
    await dispatch(createBudget({ demoMode: true }));
  }

  if (!checked) {
    return null;
  }

  return (
    <ManagerSurface
      chapter={<Trans>Protection of our home</Trans>}
      title={<Trans>Create secure access for the family.</Trans>}
      description={
        <Trans>
          This password protects the sync service used by your devices.
        </Trans>
      }
      status={<Trans>An internet connection is required for this step</Trans>}
    >
      <View style={{ width: '100%', maxWidth: 450 }}>
        <Title level={2} text={t('Protect this home')} />
        <Paragraph
          style={{ fontSize: 14, color: nossoCaderninho.color.graphite }}
        >
          <Trans>
            Choose a password for this sync service. You will use it when
            connecting another device to the same home.
          </Trans>
        </Paragraph>

        {error && (
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
        )}

        <ConfirmPasswordForm
          surface="manager"
          buttons={
            <Button
              variant="bare"
              style={{
                fontSize: 15,
                color: nossoCaderninho.color.partnership,
                marginRight: 15,
              }}
              onPress={onDemo}
            >
              {t('Try Demo')}
            </Button>
          }
          onSetPassword={onSetPassword}
          onError={setError}
        />
      </View>
    </ManagerSurface>
  );
}
