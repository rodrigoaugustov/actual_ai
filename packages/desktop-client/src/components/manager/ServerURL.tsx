import React from 'react';
import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Link } from '#components/common/Link';
import { useServerURL } from '#components/ServerContext';
import { nossoCaderninho } from '#style/nossoCaderninho';

export function ServerURL() {
  const url = useServerURL();

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        minHeight: 42,
        padding: '8px 16px calc(8px + env(safe-area-inset-bottom))',
        color: nossoCaderninho.color.graphiteSubdued,
        backgroundColor: nossoCaderninho.color.enamel,
        borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
        fontFamily: nossoCaderninho.font.family,
        fontSize: 12,
        zIndex: 5000,
      }}
    >
      <Text>
        {url ? (
          <Trans>Home sync is configured on this device</Trans>
        ) : (
          <Trans>Budgets are stored on this device</Trans>
        )}
      </Text>
      <Link
        variant="internal"
        to="/config-server"
        style={{ color: nossoCaderninho.color.partnership }}
      >
        {url ? <Trans>Review connection</Trans> : <Trans>Set up sync</Trans>}
      </Link>
    </View>
  );
}
