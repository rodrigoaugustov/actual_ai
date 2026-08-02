import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Checkbox } from '#components/forms';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { addNotification } from '#notifications/notificationsSlice';
import { saveSyncedPrefs } from '#prefs/prefsSlice';
import { useDispatch } from '#redux';

import { Setting } from './UI';

export function SpendingDisplaySettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [storedPreference] = useSyncedPref('separateTransfersFromSpending');
  const [isSaving, setIsSaving] = useState(false);
  const pendingValueRef = useRef<boolean | null>(null);
  const isSeparatingTransfers = storedPreference === 'true';

  async function changePreference(nextValue: boolean) {
    if (
      pendingValueRef.current != null ||
      nextValue === isSeparatingTransfers
    ) {
      return;
    }

    pendingValueRef.current = nextValue;
    setIsSaving(true);
    try {
      await dispatch(
        saveSyncedPrefs({
          prefs: {
            separateTransfersFromSpending: nextValue ? 'true' : 'false',
          },
        }),
      ).unwrap();
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not save this spending display preference. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      pendingValueRef.current = null;
      setIsSaving(false);
    }
  }

  return (
    <Setting>
      <Text>
        <strong>
          <Trans>Spending and transfers</Trans>
        </strong>
      </Text>
      <View
        style={{
          alignItems: 'flex-start',
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          minWidth: 0,
        }}
      >
        <Checkbox
          aria-describedby="settings-separateTransfers-description"
          checked={isSeparatingTransfers}
          disabled={isSaving}
          id="settings-separateTransfersFromSpending"
          onChange={event => {
            void changePreference(event.currentTarget.checked);
          }}
        />
        <View style={{ minWidth: 0 }}>
          <label htmlFor="settings-separateTransfersFromSpending">
            <Trans>Show transfers separately from spending</Trans>
          </label>
          <Text
            id="settings-separateTransfers-description"
            style={{ marginTop: 4 }}
          >
            <Trans>
              When enabled, budget views can show spending without transfers.
              This setting syncs with your budget and does not change your
              transactions.
            </Trans>
          </Text>
        </View>
      </View>
    </Setting>
  );
}
