import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

export function ImportModal() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  function onSelectType(type: 'ynab4' | 'ynab5' | 'actual') {
    switch (type) {
      case 'ynab4':
        dispatch(pushModal({ modal: { name: 'import-ynab4' } }));
        break;
      case 'ynab5':
        dispatch(pushModal({ modal: { name: 'import-ynab5' } }));
        break;
      case 'actual':
        dispatch(pushModal({ modal: { name: 'import-actual' } }));
        break;
      default:
    }
  }

  const itemStyle = {
    width: '100%',
    minHeight: 62,
    alignItems: 'flex-start',
    padding: nossoCaderninho.space.md,
    border: 0,
    borderRadius: 0,
    color: theme.pageText,
  };

  return (
    <Modal name="import" containerProps={{ style: { width: 440 } }}>
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Import a budget')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ gap: nossoCaderninho.space.lg }}>
            <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.45 }}>
              <Trans>
                Choose where the budget came from. We will guide you through the
                required file.
              </Trans>
            </Text>

            <View
              style={{
                overflow: 'hidden',
                border: `1px solid ${theme.tableBorder}`,
                borderRadius: nossoCaderninho.radius.control,
              }}
            >
              <Button
                variant="bare"
                style={itemStyle}
                onPress={() => onSelectType('ynab4')}
              >
                <View style={{ alignItems: 'flex-start', gap: 2 }}>
                  <Text style={{ fontWeight: 650 }}>YNAB 4</Text>
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>Desktop budget folder</Trans>
                  </Text>
                </View>
              </Button>
              <Button
                variant="bare"
                style={{
                  ...itemStyle,
                  borderTop: `1px solid ${theme.tableBorder}`,
                }}
                onPress={() => onSelectType('ynab5')}
              >
                <View style={{ alignItems: 'flex-start', gap: 2 }}>
                  <Text style={{ fontWeight: 650 }}>YNAB</Text>
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>Web budget export</Trans>
                  </Text>
                </View>
              </Button>
              <Button
                variant="bare"
                style={{
                  ...itemStyle,
                  borderTop: `1px solid ${theme.tableBorder}`,
                }}
                onPress={() => onSelectType('actual')}
              >
                <View style={{ alignItems: 'flex-start', gap: 2 }}>
                  <Text style={{ fontWeight: 650 }}>
                    <Trans>Actual legacy export</Trans>
                  </Text>
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>Previously exported ZIP file</Trans>
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}
