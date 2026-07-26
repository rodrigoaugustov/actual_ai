import React, { Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useReopenAccountMutation, useUpdateAccountMutation } from '#accounts';
import { isAccountFailedSync } from '#accounts/syncStatus';
import { movementsSurfaceClass } from '#components/accounts/movementsStyles';
import { AddTransactionButton } from '#components/mobile/transactions/AddTransactionButton';
import { MobilePageHeader, Page } from '#components/Page';
import { useAccount } from '#hooks/useAccount';
import { useSyncedPref } from '#hooks/useSyncedPref';
import {
  collapseModals,
  openAccountCloseModal,
  pushModal,
} from '#modals/modalsSlice';
import { useDispatch, useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { AccountScopeButton } from './AccountScopeButton';
import { AccountTransactions } from './AccountTransactions';
import { AllAccountTransactions } from './AllAccountTransactions';
import { OffBudgetAccountTransactions } from './OffBudgetAccountTransactions';
import { OnBudgetAccountTransactions } from './OnBudgetAccountTransactions';

export function AccountPage() {
  const { t } = useTranslation();
  const [_numberFormat] = useSyncedPref('numberFormat');
  const numberFormat = _numberFormat || 'comma-dot';
  const [hideFraction] = useSyncedPref('hideFraction');

  const { id: accountIdParam } = useParams();

  const account = useAccount(accountIdParam || '');

  const nameFromId = useCallback(
    (id: string | undefined) => {
      switch (id) {
        case 'onbudget':
          return t('On Budget Accounts');
        case 'offbudget':
          return t('Off Budget Accounts');
        case 'uncategorized':
          return t('Uncategorized');
        case 'closed':
          return t('Closed Accounts');
        default:
          return t('All Accounts');
      }
    },
    [t],
  );
  const currentName = account ? account.name : nameFromId(accountIdParam);

  return (
    <Page
      header={
        <MobilePageHeader
          style={{
            backgroundColor: nossoCaderninho.color.nav,
            borderBottom: `1px solid ${nossoCaderninho.color.navHover}`,
          }}
          title={
            <AccountScopeButton
              currentId={accountIdParam}
              currentName={currentName}
            />
          }
          leftContent={account ? <AccountHeader account={account} /> : null}
          rightContent={<AddTransactionButton accountId={account?.id} />}
        />
      }
      style={{
        minHeight: 0,
        backgroundColor: nossoCaderninho.color.enamel,
      }}
      padding={0}
    >
      <View className={movementsSurfaceClass} style={{ flex: 1, minHeight: 0 }}>
        {/* This key forces the whole table rerender when the number format changes */}
        <Fragment key={numberFormat + hideFraction}>
          {account ? (
            <AccountTransactions account={account} />
          ) : accountIdParam === 'onbudget' ? (
            <OnBudgetAccountTransactions />
          ) : accountIdParam === 'offbudget' ? (
            <OffBudgetAccountTransactions />
          ) : (
            <AllAccountTransactions />
          )}
        </Fragment>
      </View>
    </Page>
  );
}

function AccountHeader({ account }: { readonly account: AccountEntity }) {
  const { t } = useTranslation();
  const syncingAccountIds = useSelector(state => state.account.accountsSyncing);
  const pending = syncingAccountIds.includes(account.id);
  const failed = isAccountFailedSync(account);

  const dispatch = useDispatch();
  const { mutate: updateAccount } = useUpdateAccountMutation();

  const onSave = useCallback(
    (account: AccountEntity) => {
      updateAccount({ account });
    },
    [updateAccount],
  );

  const onSaveNotes = useCallback(async (id: string, notes: string) => {
    await send('notes-save', { id, note: notes });
  }, []);

  const onEditNotes = useCallback(
    (id: string) => {
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id: `account-${id}`,
              name: account.name,
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [account.name, dispatch, onSaveNotes],
  );

  const onCloseAccount = useCallback(() => {
    void dispatch(openAccountCloseModal({ accountId: account.id }));
  }, [account.id, dispatch]);

  const { mutate: reopenAccount } = useReopenAccountMutation();

  const onReopenAccount = useCallback(() => {
    reopenAccount({ id: account.id });
  }, [account.id, reopenAccount]);

  const [, setSearchParams] = useSearchParams();

  const onReconcile = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'account-reconcile',
          options: {
            accountId: account.id,
            onReconcile: (amount: number) => {
              setSearchParams(prev => {
                prev.set('reconcile', String(amount));
                return prev;
              });
              dispatch(
                collapseModals({
                  rootModalName: 'account-menu',
                }),
              );
            },
          },
        },
      }),
    );
  }, [account.id, dispatch, setSearchParams]);

  const [showRunningBalances, setShowRunningBalances] = useSyncedPref(
    `show-balances-${account.id}`,
  );
  const [hideReconciled, setHideReconciled] = useSyncedPref(
    `hide-reconciled-${account.id}`,
  );

  const onToggleRunningBalance = useCallback(() => {
    setShowRunningBalances(showRunningBalances === 'true' ? 'false' : 'true');
    dispatch(
      collapseModals({
        rootModalName: 'account-menu',
      }),
    );
  }, [showRunningBalances, setShowRunningBalances, dispatch]);

  const onToggleReconciled = useCallback(() => {
    setHideReconciled(hideReconciled === 'true' ? 'false' : 'true');
    dispatch(
      collapseModals({
        rootModalName: 'account-menu',
      }),
    );
  }, [hideReconciled, setHideReconciled, dispatch]);

  const onEditCreditCardSettings = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'credit-card-settings',
          options: { account },
        },
      }),
    );
  }, [account, dispatch]);

  const onClick = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'account-menu',
          options: {
            accountId: account.id,
            onSave,
            onEditNotes,
            onCloseAccount,
            onReopenAccount,
            onReconcile,
            onToggleRunningBalance,
            onToggleReconciled,
            onEditCreditCardSettings,
          },
        },
      }),
    );
  }, [
    account.id,
    dispatch,
    onCloseAccount,
    onEditCreditCardSettings,
    onEditNotes,
    onReconcile,
    onReopenAccount,
    onSave,
    onToggleRunningBalance,
    onToggleReconciled,
  ]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {account.bank && (
        <View
          style={{
            margin: 'auto',
            marginRight: 5,
            width: 8,
            height: 8,
            borderRadius: 8,
            flexShrink: 0,
            backgroundColor: pending
              ? theme.sidebarItemBackgroundPending
              : failed
                ? theme.sidebarItemBackgroundFailed
                : theme.sidebarItemBackgroundPositive,
            transition: 'transform .3s',
          }}
        />
      )}
      <Button
        variant="bare"
        aria-label={t('Account menu')}
        onPress={onClick}
        style={{
          minWidth: 38,
          minHeight: 38,
          color: nossoCaderninho.color.navText,
        }}
      >
        <SvgDotsHorizontalTriple width={16} height={16} />
      </Button>
    </View>
  );
}
