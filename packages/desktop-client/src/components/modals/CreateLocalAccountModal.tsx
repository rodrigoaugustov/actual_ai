// @ts-strict-ignore
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { FormError } from '@actual-app/components/form-error';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { toRelaxedNumber } from '@actual-app/core/shared/util';

import { useCreateAccountMutation } from '#accounts';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { Checkbox } from '#components/forms';
import { validateAccountName } from '#components/util/accountValidation';
import { useAccounts } from '#hooks/useAccounts';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { closeModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

export function CreateLocalAccountModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isUsingServer = useSyncServerStatus() !== 'no-server';
  const { data: accounts = [] } = useAccounts();
  const [name, setName] = useState('');
  const [offbudget, setOffbudget] = useState(false);
  const [balance, setBalance] = useState('0');

  const [nameError, setNameError] = useState(null);
  const [balanceError, setBalanceError] = useState(false);

  const validateBalance = balance => !isNaN(parseFloat(balance));

  const validateAndSetName = (name: string) => {
    const nameError = validateAccountName(name, '', accounts);
    if (nameError) {
      setNameError(nameError);
    } else {
      setName(name);
      setNameError(null);
    }
  };

  const createAccount = useCreateAccountMutation();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nameError = validateAccountName(name, '', accounts);

    const balanceError = !validateBalance(balance);
    setBalanceError(balanceError);

    if (!nameError && !balanceError) {
      createAccount.mutate(
        {
          name,
          balance: toRelaxedNumber(balance),
          offBudget: offbudget,
        },
        {
          onSuccess: id => {
            dispatch(closeModal());
            void navigate('/accounts/' + id);
          },
        },
      );
    }
  };
  return (
    <Modal name="add-local-account">
      {({ state }) => (
        <>
          <ModalHeader
            title={
              <ModalTitle title={t('Create local account')} shrinkOnOverflow />
            }
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ gap: nossoCaderninho.space.lg }}>
            <Text
              style={{
                color: theme.pageTextSubdued,
                lineHeight: 1.45,
              }}
            >
              <Trans>
                Add this account to the family records. You can enter
                transactions manually or import a bank file after creating it.
              </Trans>
            </Text>
            <Form onSubmit={onSubmit}>
              <label
                htmlFor="new-account-name"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: nossoCaderninho.space.sm,
                  marginBottom: nossoCaderninho.space.lg,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: 650 }}>
                  <Trans>Account name</Trans>
                </Text>
                <InitialFocus>
                  <Input
                    id="new-account-name"
                    name="name"
                    value={name}
                    placeholder={t('e.g. Joint account or Credit card')}
                    onChangeValue={setName}
                    onUpdate={value => {
                      const name = value.trim();
                      validateAndSetName(name);
                    }}
                    style={{ width: '100%', minHeight: 36 }}
                  />
                </InitialFocus>
              </label>
              {nameError && (
                <FormError
                  style={{
                    marginTop: -nossoCaderninho.space.sm,
                    marginBottom: nossoCaderninho.space.md,
                    color: theme.warningText,
                  }}
                >
                  {nameError}
                </FormError>
              )}

              <View
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: nossoCaderninho.space.sm,
                  marginBottom: nossoCaderninho.space.lg,
                  padding: nossoCaderninho.space.md,
                  border: `1px solid ${theme.tableBorder}`,
                  borderRadius: nossoCaderninho.radius.control,
                }}
              >
                <Checkbox
                  id="offbudget"
                  name="offbudget"
                  checked={offbudget}
                  onChange={() => setOffbudget(!offbudget)}
                />
                <label
                  htmlFor="offbudget"
                  aria-label={t('Track outside the spending budget')}
                  style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    gap: nossoCaderninho.space.xs,
                    userSelect: 'none',
                  }}
                >
                  <Text style={{ fontWeight: 650 }}>
                    <Trans>Track outside the spending budget</Trans>
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      lineHeight: 1.4,
                      color: theme.pageTextSubdued,
                    }}
                  >
                    <Trans>
                      Use this for investments, loans or property. This choice
                      cannot be changed later.
                    </Trans>
                  </Text>
                </label>
              </View>

              <label
                htmlFor="new-account-balance"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: nossoCaderninho.space.sm,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: 650 }}>
                  <Trans>Current balance</Trans>
                </Text>
                <Input
                  id="new-account-balance"
                  name="balance"
                  inputMode="decimal"
                  value={balance}
                  onChangeValue={setBalance}
                  onUpdate={value => {
                    const balance = value.trim();
                    setBalance(balance);
                    if (validateBalance(balance) && balanceError) {
                      setBalanceError(false);
                    }
                  }}
                  style={{ width: '100%', minHeight: 36 }}
                />
              </label>
              {balanceError && (
                <FormError style={{ marginTop: nossoCaderninho.space.sm }}>
                  <Trans>Balance must be a number</Trans>
                </FormError>
              )}

              <ModalButtons>
                <Button onPress={() => state.close()} style={{ minHeight: 36 }}>
                  {isUsingServer ? <Trans>Back</Trans> : <Trans>Cancel</Trans>}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ minWidth: 120, minHeight: 36 }}
                >
                  <Trans>Create account</Trans>
                </Button>
              </ModalButtons>
            </Form>
          </View>
        </>
      )}
    </Modal>
  );
}
