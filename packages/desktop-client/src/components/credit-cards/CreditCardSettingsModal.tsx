import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { InlineField } from '@actual-app/components/inline-field';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { AccountEntity } from '@actual-app/core/types/models';
import { useQueryClient } from '@tanstack/react-query';

import { accountQueries } from '#accounts';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

const NOT_SET = 0;

type CreditCardSettingsModalProps = {
  account: AccountEntity;
};

export function CreditCardSettingsModal({
  account,
}: CreditCardSettingsModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [closingDay, setClosingDay] = useState<number>(
    account.closing_day ?? NOT_SET,
  );
  const [dueDay, setDueDay] = useState<number>(account.due_day ?? NOT_SET);
  const [isSaving, setIsSaving] = useState(false);

  const isEnabled = closingDay !== NOT_SET && dueDay !== NOT_SET;
  // Valid configs: both days set (card mode) or both unset (regular
  // account) — a single set day is incomplete
  const isValid = isEnabled || (closingDay === NOT_SET && dueDay === NOT_SET);
  const bestPurchaseDay =
    closingDay === NOT_SET ? null : closingDay >= 31 ? 1 : closingDay + 1;

  const dayOptions: Array<[number, string]> = [
    [NOT_SET, t('Not set')],
    ...Array.from(
      { length: 31 },
      (_, idx) => [idx + 1, String(idx + 1)] as [number, string],
    ),
  ];

  const onSave = async (close: () => void) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await send('credit-card/update-config', {
        id: account.id,
        closingDay: closingDay === NOT_SET ? null : closingDay,
        dueDay: dueDay === NOT_SET ? null : dueDay,
      });
      await queryClient.invalidateQueries({
        queryKey: accountQueries.lists(),
      });
      close();
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not save the credit card settings. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal name="credit-card-settings">
      {({ state }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('Credit card settings')} />}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ maxWidth: 500 }}>
            <Text
              style={{
                color: theme.pageTextSubdued,
                lineHeight: 1.5,
                marginBottom: 15,
              }}
            >
              <Trans>
                Setting both a closing day and a due day turns this account into
                a credit card with statement tracking. Clearing either day turns
                it back into a regular account.
              </Trans>
            </Text>

            <InlineField label={t('Statement closing day')} width="100%">
              <Select
                options={dayOptions}
                value={closingDay}
                onChange={value => setClosingDay(value)}
              />
            </InlineField>

            <InlineField label={t('Payment due day')} width="100%">
              <Select
                options={dayOptions}
                value={dueDay}
                onChange={value => setDueDay(value)}
              />
            </InlineField>

            {bestPurchaseDay != null && (
              <InlineField label={t('Best purchase day')} width="100%">
                <Text style={{ alignSelf: 'center' }}>
                  {String(bestPurchaseDay)}
                </Text>
              </InlineField>
            )}

            {closingDay >= 29 && (
              <Text
                style={{
                  color: theme.warningText,
                  fontSize: '0.9em',
                  marginTop: 10,
                }}
              >
                <Trans>
                  In months shorter than the chosen day, the statement closes on
                  the last day of the month.
                </Trans>
              </Text>
            )}

            <ModalButtons style={{ gap: 8 }}>
              <Button style={{ minHeight: 40 }} onPress={() => state.close()}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                isDisabled={isSaving || !isValid}
                onPress={() => onSave(() => state.close())}
                style={{ minHeight: 40 }}
              >
                <Trans>Save</Trans>
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
