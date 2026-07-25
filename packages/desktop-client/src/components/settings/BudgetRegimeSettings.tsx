import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { send } from '@actual-app/core/platform/client/connection';

import { useSyncedPref } from '#hooks/useSyncedPref';
import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { saveSyncedPrefs } from '#prefs/prefsSlice';
import { useDispatch } from '#redux';

import { Column, Setting } from './UI';

type BudgetRegime = 'purchase' | 'payment';

export function BudgetRegimeSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [storedBudgetRegime] = useSyncedPref('budgetRegime');
  const budgetRegime: BudgetRegime =
    storedBudgetRegime === 'payment' ? 'payment' : 'purchase';
  const pendingRef = useRef<BudgetRegime | null>(null);
  const [pendingRegime, setPendingRegime] = useState<BudgetRegime | null>(null);

  async function changeRegime(nextRegime: BudgetRegime) {
    if (pendingRef.current != null || nextRegime === budgetRegime) {
      return;
    }

    const previousRegime = budgetRegime;
    pendingRef.current = nextRegime;
    setPendingRegime(nextRegime);
    try {
      await dispatch(
        saveSyncedPrefs({ prefs: { budgetRegime: nextRegime } }),
      ).unwrap();
      await send('reset-budget-cache');
    } catch {
      try {
        await dispatch(
          saveSyncedPrefs({ prefs: { budgetRegime: previousRegime } }),
        ).unwrap();
        await send('reset-budget-cache');
      } catch {
        // Keep the original failure notification. A later retry or budget
        // reload will reconcile the preference and calculated budget cache.
      }
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not change the budget regime. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      pendingRef.current = null;
      setPendingRegime(null);
    }
  }

  function requestRegimeChange(nextRegime: BudgetRegime) {
    if (pendingRef.current != null || nextRegime === budgetRegime) {
      return;
    }

    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            title: t('Change budget regime?'),
            message: t(
              'Your budget will be recalculated using the selected credit card regime.',
            ),
            confirmLabel: t('Change regime'),
            onConfirm: () => {
              void changeRegime(nextRegime);
            },
          },
        },
      }),
    );
  }

  return (
    <Setting
      primaryAction={
        <Column title={t('Budget regime')}>
          <fieldset
            aria-label={t('Budget regime')}
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              border: 0,
              margin: 0,
              padding: 0,
            }}
          >
            <ButtonWithLoading
              aria-pressed={budgetRegime === 'purchase'}
              variant={budgetRegime === 'purchase' ? 'primary' : 'normal'}
              isLoading={pendingRegime === 'purchase'}
              isDisabled={pendingRegime != null}
              onPress={() => requestRegimeChange('purchase')}
            >
              <Trans>Purchase date</Trans>
            </ButtonWithLoading>
            <ButtonWithLoading
              aria-pressed={budgetRegime === 'payment'}
              variant={budgetRegime === 'payment' ? 'primary' : 'normal'}
              isLoading={pendingRegime === 'payment'}
              isDisabled={pendingRegime != null}
              onPress={() => requestRegimeChange('payment')}
            >
              <Trans>Statement due date</Trans>
            </ButtonWithLoading>
          </fieldset>
        </Column>
      }
    >
      <Text>
        <Trans>
          <strong>Budget regime</strong> controls when credit card expenses hit
          your budget. With <strong>purchase date</strong> (the default), an
          expense counts in the month of the purchase, exactly as before. With{' '}
          <strong>statement due date</strong>, expenses on credit card accounts
          with statement tracking count in the month their statement is due —
          matching how the bill actually affects your cash flow.
        </Trans>
      </Text>
      <Text>
        <Trans>
          Accounts without credit card settings, and all existing data, are not
          affected. Reports always use the purchase date.
        </Trans>
      </Text>
    </Setting>
  );
}
