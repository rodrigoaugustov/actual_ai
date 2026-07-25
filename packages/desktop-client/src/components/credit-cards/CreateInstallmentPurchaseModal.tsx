import { useState } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { InlineField } from '@actual-app/components/inline-field';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { evalArithmetic } from '@actual-app/core/shared/arithmetic';
import * as monthUtils from '@actual-app/core/shared/months';
import {
  amountToInteger,
  integerToCurrency,
} from '@actual-app/core/shared/util';
import type { AccountEntity } from '@actual-app/core/types/models';
import { useQueryClient } from '@tanstack/react-query';

import { CategoryAutocomplete } from '#components/autocomplete/CategoryAutocomplete';
import { PayeeAutocomplete } from '#components/autocomplete/PayeeAutocomplete';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { DateSelect } from '#components/select/DateSelect';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

const MIN_INSTALLMENTS = 2;
const MAX_INSTALLMENTS = 36;

type CreateInstallmentPurchaseModalProps = {
  account: AccountEntity;
};

export function CreateInstallmentPurchaseModal({
  account,
}: CreateInstallmentPurchaseModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();
  const {
    data: { grouped: categoryGroups } = { grouped: [] },
    isError: isCategoriesError,
    isLoading: isCategoriesLoading,
  } = useCategories();

  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('2');
  const [date, setDate] = useState(monthUtils.currentDay());
  const [isSaving, setIsSaving] = useState(false);

  const parsedAmount = evalArithmetic(amount || '');
  const parsedCount = parseInt(count, 10);
  const isCountValid =
    Number.isInteger(parsedCount) &&
    parsedCount >= MIN_INSTALLMENTS &&
    parsedCount <= MAX_INSTALLMENTS;
  const isValid = parsedAmount != null && parsedAmount !== 0 && isCountValid;

  const preview: number[] = isValid
    ? distributePreview(amountToInteger(-Math.abs(parsedAmount)), parsedCount)
    : [];

  const onSave = async (close: () => void) => {
    if (isSaving || !isValid) {
      return;
    }
    setIsSaving(true);
    try {
      await send('credit-card/create-installments', {
        account: account.id,
        payee: payeeId ?? undefined,
        category: categoryId ?? undefined,
        amount: amountToInteger(-Math.abs(parsedAmount as number)),
        count: parsedCount,
        date,
      });
      await queryClient.invalidateQueries();
      close();
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not create the installment purchase. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal name="credit-card-installment-purchase">
      {({ state }) => (
        <>
          <ModalHeader
            title={<ModalTitle title={t('New installment purchase')} />}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ maxWidth: 500 }}>
            <Form
              onSubmit={e => {
                e.preventDefault();
                void onSave(() => state.close());
              }}
            >
              <InlineField label={t('Payee')} width="100%">
                <PayeeAutocomplete
                  value={payeeId}
                  openOnFocus
                  showMakeTransfer={false}
                  onSelect={id => setPayeeId(id ?? null)}
                />
              </InlineField>

              <InlineField label={t('Category')} width="100%">
                {isCategoriesLoading ? (
                  <View style={{ alignItems: 'center', padding: 10 }}>
                    <AnimatedLoading width={20} color={theme.pageTextSubdued} />
                  </View>
                ) : isCategoriesError ? (
                  <Text style={{ color: theme.errorText }}>
                    <Trans>Could not load categories.</Trans>
                  </Text>
                ) : (
                  <CategoryAutocomplete
                    categoryGroups={categoryGroups}
                    value={null}
                    openOnFocus
                    onSelect={id => setCategoryId(id ?? null)}
                    inputProps={{ placeholder: t('(none)') }}
                  />
                )}
              </InlineField>

              <InlineField label={t('Total amount')} width="100%">
                <Input
                  value={amount}
                  onChangeValue={setAmount}
                  placeholder="0.00"
                  style={{ flex: 1 }}
                />
              </InlineField>

              <InlineField label={t('Installments')} width="100%">
                <Input
                  type="number"
                  min={MIN_INSTALLMENTS}
                  max={MAX_INSTALLMENTS}
                  value={count}
                  onChangeValue={setCount}
                  style={{ flex: 1 }}
                />
              </InlineField>

              <InlineField label={t('First purchase date')} width="100%">
                <DateSelect
                  value={date}
                  dateFormat={dateFormat}
                  onSelect={setDate}
                />
              </InlineField>

              {isValid && (
                <View
                  style={{
                    marginTop: 10,
                    padding: '6px 10px',
                    border: '1px solid ' + theme.tableBorder,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>Preview</Trans>
                  </Text>
                  {preview.map((installmentAmount, idx) => (
                    <Text key={idx} style={{ display: 'block' }}>
                      {idx + 1}/{parsedCount}:{' '}
                      {integerToCurrency(installmentAmount)}
                    </Text>
                  ))}
                </View>
              )}

              <ModalButtons>
                <Button onPress={() => state.close()}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={isSaving || !isValid}
                  style={{ marginLeft: 10 }}
                >
                  <Trans>Create</Trans>
                </Button>
              </ModalButtons>
            </Form>
          </View>
        </>
      )}
    </Modal>
  );
}

function distributePreview(totalCents: number, n: number): number[] {
  const base = Math.trunc(totalCents / n);
  const remainder = totalCents - base * n;
  return [base + remainder, ...Array(n - 1).fill(base)];
}
