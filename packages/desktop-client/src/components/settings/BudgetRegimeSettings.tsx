import { useState } from 'react';
import { Trans } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { send } from '@actual-app/core/platform/client/connection';

import { useSyncedPref } from '#hooks/useSyncedPref';

import { Setting } from './UI';

export function BudgetRegimeSettings() {
  const [budgetRegime = 'purchase', setBudgetRegime] =
    useSyncedPref('budgetRegime');
  const [isLoading, setIsLoading] = useState(false);

  async function onSwitchRegime() {
    setIsLoading(true);
    try {
      setBudgetRegime(budgetRegime === 'purchase' ? 'payment' : 'purchase');

      // The pref-change rebuild runs fire-and-forget inside a
      // synchronous DB transaction on the server (same constraint as
      // the budget-type switch), so explicitly reset and await here
      // rather than relying on that background rebuild to have
      // settled before this resolves
      await send('reset-budget-cache');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Setting
      primaryAction={
        <ButtonWithLoading onPress={onSwitchRegime} isLoading={isLoading}>
          {budgetRegime === 'payment' ? (
            <Trans>Switch to purchase date budgeting</Trans>
          ) : (
            <Trans>Switch to statement due date budgeting</Trans>
          )}
        </ButtonWithLoading>
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
