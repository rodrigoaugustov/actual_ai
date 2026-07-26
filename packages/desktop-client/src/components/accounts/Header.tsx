import React, { useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Dialog, DialogTrigger } from 'react-aria-components';
import { useHotkeys } from 'react-hotkeys-hook';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import {
  SvgAdd,
  SvgDotsHorizontalTriple,
} from '@actual-app/components/icons/v1';
import {
  SvgArrowsExpand3,
  SvgArrowsShrink3,
  SvgDownloadThickBottom,
  SvgLockClosed,
  SvgPencil1,
} from '@actual-app/components/icons/v2';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { tsToRelativeTime } from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  RuleConditionEntity,
  TransactionEntity,
  TransactionFilterEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import { format as formatDate } from 'date-fns';

import { isAccountFailedSync } from '#accounts/syncStatus';
import { ClassifyTransactionsWithAiButton } from '#components/ai/ClassifyTransactionsWithAiButton';
import { AnimatedRefresh } from '#components/AnimatedRefresh';
import { Search } from '#components/common/Search';
import { FilterButton } from '#components/filters/FiltersMenu';
import { FiltersStack } from '#components/filters/FiltersStack';
import type { SavedFilter } from '#components/filters/SavedFilterMenuButton';
import { AccountScopeButton } from '#components/mobile/accounts/AccountScopeButton';
import { NotesButton } from '#components/NotesButton';
import { SelectedTransactionsButton } from '#components/transactions/SelectedTransactionsButton';
import { useDateFormat } from '#hooks/useDateFormat';
import { useLocale } from '#hooks/useLocale';
import { useLocalPref } from '#hooks/useLocalPref';
import { useSelectedItems } from '#hooks/useSelected';
import { useSplitsExpanded } from '#hooks/useSplitsExpanded';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { nossoCaderninho } from '#style/nossoCaderninho';

import type { TableRef } from './Account';
import { Balances } from './Balance';
import { BalanceHistoryGraph } from './BalanceHistoryGraph';
import { MonthFilterButton } from './MonthFilterButton';
import { ReconcileMenu, ReconcilingMessage } from './Reconcile';

/** Manual trigger for the classifier, shown only on the cross-account
 * "Uncategorized" view (see AccountHeader below). Classifies whatever is
 * currently selected via the register's normal row checkboxes, or every
 * uncategorized transaction in view if nothing is selected — the sync-time
 * classification hook keeps running independently of this. */
function ClassifyUncategorizedButton({
  transactions,
}: {
  transactions: TransactionEntity[];
}) {
  const selectedItems = useSelectedItems();

  return (
    <ClassifyTransactionsWithAiButton
      transactions={transactions}
      selectedIds={[...selectedItems]}
    />
  );
}

type AccountHeaderProps = {
  tableRef: TableRef;
  isNameEditable: boolean;
  workingHard: boolean;
  accountName: string;
  accountId?: string;
  account?: AccountEntity;
  filterId?: SavedFilter;
  savedFilters: TransactionFilterEntity[];
  accountsSyncing: string[];
  accounts: AccountEntity[];
  transactions: TransactionEntity[];
  showBalances: boolean;
  showExtraBalances: boolean;
  showCleared: boolean;
  showReconciled: boolean;
  showEmptyMessage: boolean;
  balanceQuery: ComponentProps<typeof ReconcilingMessage>['balanceQuery'];
  reconcileAmount?: number | null;
  canCalculateBalance?: () => boolean;
  isFiltered: boolean;
  filteredAmount?: number | null;
  isSorted: boolean;
  search: string;
  filterConditions: RuleConditionEntity[];
  filterConditionsOp: 'and' | 'or';
  onSearch: (newSearch: string) => void;
  onAddTransaction: () => void;
  onShowTransactions: ComponentProps<
    typeof SelectedTransactionsButton
  >['onShow'];
  onDoneReconciling: ComponentProps<typeof ReconcilingMessage>['onDone'];
  onCreateReconciliationTransaction: ComponentProps<
    typeof ReconcilingMessage
  >['onCreateTransaction'];
  onToggleExtraBalances: ComponentProps<
    typeof Balances
  >['onToggleExtraBalances'];
  onSaveName: AccountNameFieldProps['onSaveName'];
  saveNameError: AccountNameFieldProps['saveNameError'];
  onSync: () => void;
  onImport: () => void;
  onMenuSelect: AccountMenuProps['onMenuSelect'];
  onReconcile: ComponentProps<typeof ReconcileMenu>['onReconcile'];
  onBatchEdit: ComponentProps<typeof SelectedTransactionsButton>['onEdit'];
  onRunRules: ComponentProps<typeof SelectedTransactionsButton>['onRunRules'];
  onBatchDelete: ComponentProps<typeof SelectedTransactionsButton>['onDelete'];
  onBatchDuplicate: ComponentProps<
    typeof SelectedTransactionsButton
  >['onDuplicate'];
  onBatchLinkSchedule: ComponentProps<
    typeof SelectedTransactionsButton
  >['onLinkSchedule'];
  onBatchUnlinkSchedule: ComponentProps<
    typeof SelectedTransactionsButton
  >['onUnlinkSchedule'];
  onApplyFilter: (filter: RuleConditionEntity) => void;
} & Pick<
  ComponentProps<typeof SelectedTransactionsButton>,
  | 'onCreateRule'
  | 'onScheduleAction'
  | 'onSetTransfer'
  | 'onMakeAsSplitTransaction'
  | 'onMakeAsNonSplitTransactions'
  | 'onMergeTransactions'
> &
  Pick<
    ComponentProps<typeof FiltersStack>,
    | 'onUpdateFilter'
    | 'onDeleteFilter'
    | 'onConditionsOpChange'
    | 'onClearFilters'
    | 'onReloadSavedFilter'
  >;

export function AccountHeader({
  tableRef,
  isNameEditable,
  workingHard,
  accountName,
  accountId,
  account,
  filterId,
  savedFilters,
  accountsSyncing,
  accounts,
  transactions,
  showBalances,
  showExtraBalances,
  showCleared,
  showReconciled,
  showEmptyMessage,
  balanceQuery,
  reconcileAmount,
  canCalculateBalance,
  isFiltered,
  filteredAmount,
  isSorted,
  search,
  filterConditions,
  filterConditionsOp,
  onSearch,
  onAddTransaction,
  onShowTransactions,
  onDoneReconciling,
  onCreateReconciliationTransaction,
  onToggleExtraBalances,
  onSaveName,
  saveNameError,
  onSync,
  onImport,
  onMenuSelect,
  onReconcile,
  onBatchDelete,
  onBatchDuplicate,
  onBatchEdit,
  onBatchLinkSchedule,
  onBatchUnlinkSchedule,
  onCreateRule,
  onApplyFilter,
  onUpdateFilter,
  onClearFilters,
  onReloadSavedFilter,
  onConditionsOpChange,
  onDeleteFilter,
  onScheduleAction,
  onSetTransfer,
  onRunRules,
  onMakeAsSplitTransaction,
  onMakeAsNonSplitTransactions,
  onMergeTransactions,
}: AccountHeaderProps) {
  const { t } = useTranslation();

  const [reconcileOpen, setReconcileOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const reconcileRef = useRef(null);
  const splitsExpanded = useSplitsExpanded();
  const syncServerStatus = useSyncServerStatus();
  const isUsingServer = syncServerStatus !== 'no-server';
  const isServerOffline = syncServerStatus === 'offline';
  const [_, setExpandSplitsPref] = useLocalPref('expand-splits');
  const [showNetWorthChartPref, _setShowNetWorthChartPref] = useSyncedPref(
    `show-account-${accountId}-net-worth-chart`,
  );
  const showNetWorthChart = showNetWorthChartPref === 'true';

  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const locale = useLocale();

  let canSync = !!(account?.account_id && isUsingServer);
  if (!account) {
    // All accounts - check for any syncable account
    canSync = !!accounts.find(account => !!account.account_id) && isUsingServer;
  }

  // Only show the ability to make linked transfers on multi-account views.
  const showMakeTransfer = !account;

  function onToggleSplits() {
    if (tableRef.current) {
      splitsExpanded.dispatch({
        type: 'switch-mode',
        id: tableRef.current.getScrolledItem(),
      });

      setExpandSplitsPref(!(splitsExpanded.state.mode === 'expand'));
    }
  }

  const graphRef = useRef<HTMLDivElement>(null);

  useHotkeys(
    'ctrl+f, cmd+f, meta+f',
    e => {
      if (searchInput.current) {
        // Trigger browser-native find if user pressed search twice in a row
        if (document.activeElement === searchInput.current) {
          searchInput.current.blur();
        } else {
          e.preventDefault();
          searchInput.current.focus();
        }
      }
    },
    {
      enableOnFormTags: true,
      preventDefault: false,
      scopes: ['app'],
    },
    [searchInput],
  );
  useHotkeys(
    't',
    () => onAddTransaction(),
    {
      preventDefault: true,
      scopes: ['app'],
    },
    [onAddTransaction],
  );
  useHotkeys(
    'ctrl+i, cmd+i, meta+i',
    () => onImport(),
    {
      scopes: ['app'],
    },
    [onImport],
  );
  useHotkeys(
    'ctrl+b, cmd+b, meta+b',
    () => onSync(),
    {
      enabled: canSync && !isServerOffline,
      preventDefault: true,
      scopes: ['app'],
    },
    [onSync],
  );

  return (
    <>
      <header className={headerClass}>
        <div className={overviewClass}>
          <div className={accountSummaryClass}>
            <div className={accountIdentityClass}>
              {!!account?.bank && (
                <AccountSyncSidebar
                  account={account}
                  accountsSyncing={accountsSyncing}
                />
              )}
              <AccountNameField
                account={account}
                accountName={accountName}
                isNameEditable={isNameEditable}
                saveNameError={saveNameError}
                onSaveName={onSaveName}
              />
            </div>

            <Balances
              balanceQuery={balanceQuery}
              showExtraBalances={showExtraBalances}
              onToggleExtraBalances={onToggleExtraBalances}
              account={account}
              isFiltered={isFiltered}
              filteredAmount={filteredAmount}
            />
          </div>

          <BalanceHistoryGraph
            ref={graphRef}
            accountId={accountId}
            style={{
              height: 'calc(5vh + 5vw)',
              margin: 0,
              display: showNetWorthChart ? 'flex' : 'none',
            }}
          />
        </div>
        <div className={commandRailClass}>
          <AccountScopeButton
            currentId={accountId}
            currentName={accountName}
            appearance="surface"
          />
          {canSync && (
            <Button
              variant="bare"
              onPress={onSync}
              isDisabled={isServerOffline}
            >
              <AnimatedRefresh
                width={13}
                height={13}
                animating={
                  account
                    ? accountsSyncing.includes(account.id)
                    : accountsSyncing.length > 0
                }
              />{' '}
              {isServerOffline ? t('Bank Sync Offline') : t('Bank Sync')}
            </Button>
          )}

          {account && !account.closed && (
            <Button variant="bare" onPress={onImport}>
              <SvgDownloadThickBottom
                width={13}
                height={13}
                style={{ marginRight: 4 }}
              />{' '}
              <Trans>Import</Trans>
            </Button>
          )}

          {!showEmptyMessage && (
            <Button variant="bare" onPress={onAddTransaction}>
              <SvgAdd width={10} height={10} style={{ marginRight: 3 }} />
              <Trans>Add New</Trans>
            </Button>
          )}
          <View style={{ flexShrink: 0 }}>
            {/* @ts-expect-error fix me */}
            <FilterButton onApply={onApplyFilter} />
          </View>
          {account && (
            <View style={{ flexShrink: 0 }}>
              {/* @ts-expect-error fix me */}
              <MonthFilterButton onApply={onApplyFilter} />
            </View>
          )}
          <div className={commandSpacerClass} />

          <div className={searchClass}>
            <Search
              placeholder={t('Search')}
              value={search}
              width="100%"
              height={36}
              onChange={onSearch}
              ref={searchInput}
              style={{ borderColor: nossoCaderninho.color.rail }}
            />
          </div>
          {accountId === 'uncategorized' && (
            <ClassifyUncategorizedButton transactions={transactions} />
          )}
          {workingHard ? (
            <View>
              <AnimatedLoading style={{ width: 16, height: 16 }} />
            </View>
          ) : (
            <SelectedTransactionsButton
              getTransaction={id => transactions.find(t => t.id === id)}
              onShow={onShowTransactions}
              onDuplicate={onBatchDuplicate}
              onDelete={onBatchDelete}
              onEdit={onBatchEdit}
              onRunRules={onRunRules}
              onLinkSchedule={onBatchLinkSchedule}
              onUnlinkSchedule={onBatchUnlinkSchedule}
              onCreateRule={onCreateRule}
              onSetTransfer={onSetTransfer}
              onScheduleAction={onScheduleAction}
              showMakeTransfer={showMakeTransfer}
              onMakeAsSplitTransaction={onMakeAsSplitTransaction}
              onMakeAsNonSplitTransactions={onMakeAsNonSplitTransactions}
              onMergeTransactions={onMergeTransactions}
            />
          )}
          <View style={{ flex: '0 0 auto' }}>
            {account && (
              <Tooltip
                style={{
                  ...styles.tooltip,
                  marginBottom: 10,
                }}
                content={
                  account?.last_reconciled
                    ? t(
                        'Reconciled {{ relativeTimeAgo }} ({{ absoluteDate }})',
                        {
                          relativeTimeAgo: tsToRelativeTime(
                            account.last_reconciled,
                            locale,
                          ),
                          absoluteDate: formatDate(
                            new Date(
                              parseInt(account.last_reconciled ?? '0', 10),
                            ),
                            dateFormat,
                            { locale },
                          ),
                        },
                      )
                    : t('Not yet reconciled')
                }
                placement="top"
                triggerProps={{
                  isDisabled: reconcileOpen,
                }}
              >
                <Button
                  ref={reconcileRef}
                  variant="bare"
                  aria-label={t('Reconcile')}
                  style={{ padding: 6 }}
                  onPress={() => {
                    setReconcileOpen(true);
                  }}
                >
                  <View>
                    <SvgLockClosed width={14} height={14} />
                  </View>
                </Button>
                <Popover
                  placement="bottom"
                  triggerRef={reconcileRef}
                  style={{ width: 275 }}
                  isOpen={reconcileOpen}
                  onOpenChange={() => setReconcileOpen(false)}
                >
                  <ReconcileMenu
                    account={account}
                    onClose={() => setReconcileOpen(false)}
                    onReconcile={onReconcile}
                  />
                </Popover>
              </Tooltip>
            )}
          </View>
          <Button
            variant="bare"
            aria-label={
              splitsExpanded.state.mode === 'collapse'
                ? t('Collapse split transactions')
                : t('Expand split transactions')
            }
            style={{ padding: 6 }}
            onPress={onToggleSplits}
          >
            <View
              title={
                splitsExpanded.state.mode === 'collapse'
                  ? t('Collapse split transactions')
                  : t('Expand split transactions')
              }
            >
              {splitsExpanded.state.mode === 'collapse' ? (
                <SvgArrowsShrink3 style={{ width: 14, height: 14 }} />
              ) : (
                <SvgArrowsExpand3 style={{ width: 14, height: 14 }} />
              )}
            </View>
          </Button>
          {account ? (
            <View style={{ flex: '0 0 auto' }}>
              <DialogTrigger>
                <Button variant="bare" aria-label={t('Account menu')}>
                  <SvgDotsHorizontalTriple
                    width={15}
                    height={15}
                    style={{ transform: 'rotateZ(90deg)' }}
                  />
                </Button>

                <Popover style={{ minWidth: 275 }}>
                  <Dialog>
                    <AccountMenu
                      account={account}
                      canSync={canSync}
                      showNetWorthChart={showNetWorthChart}
                      canShowBalances={
                        canCalculateBalance ? canCalculateBalance() : false
                      }
                      isSorted={isSorted}
                      showBalances={showBalances}
                      showCleared={showCleared}
                      showReconciled={showReconciled}
                      onMenuSelect={onMenuSelect}
                    />
                  </Dialog>
                </Popover>
              </DialogTrigger>
            </View>
          ) : (
            <View style={{ flex: '0 0 auto' }}>
              <DialogTrigger>
                <Button variant="bare" aria-label={t('Account menu')}>
                  <SvgDotsHorizontalTriple
                    width={15}
                    height={15}
                    style={{ transform: 'rotateZ(90deg)' }}
                  />
                </Button>

                <Popover>
                  <Dialog>
                    <Menu
                      slot="close"
                      onMenuSelect={onMenuSelect}
                      items={[
                        ...(isSorted
                          ? [
                              {
                                name: 'remove-sorting',
                                text: t('Remove all sorting'),
                              } as const,
                            ]
                          : []),
                        { name: 'export', text: t('Export') },
                        {
                          name: 'toggle-net-worth-chart',
                          text: showNetWorthChart
                            ? t('Hide balance chart')
                            : t('Show balance chart'),
                        },
                      ]}
                    />
                  </Dialog>
                </Popover>
              </DialogTrigger>
            </View>
          )}
        </div>
        {filterConditions?.length > 0 && (
          <div className={filtersClass}>
            <FiltersStack
              conditions={filterConditions}
              conditionsOp={filterConditionsOp}
              onUpdateFilter={onUpdateFilter}
              onDeleteFilter={onDeleteFilter}
              onClearFilters={onClearFilters}
              onReloadSavedFilter={onReloadSavedFilter}
              filterId={filterId}
              savedFilters={savedFilters}
              onConditionsOpChange={onConditionsOpChange}
            />
          </div>
        )}
      </header>
      {reconcileAmount != null && (
        <ReconcilingMessage
          targetBalance={reconcileAmount}
          balanceQuery={balanceQuery}
          onDone={onDoneReconciling}
          onCreateTransaction={onCreateReconciliationTransaction}
        />
      )}
    </>
  );
}

const headerClass = css({
  flexShrink: 0,
  minWidth: 0,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.rail}`,
});

const overviewClass = css({
  minWidth: 0,
  padding: `${nossoCaderninho.space.lg}px ${nossoCaderninho.space.xl}px`,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: nossoCaderninho.space.md,
});

const accountSummaryClass = css({
  minWidth: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.xl,
  '@media (max-width: 899px)': {
    flexDirection: 'column',
    gap: nossoCaderninho.space.sm,
  },
});

const accountIdentityClass = css({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.xs,
});

const commandRailClass = css({
  minWidth: 0,
  minHeight: 52,
  padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.lg}px`,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: nossoCaderninho.space.xs,
  backgroundColor: nossoCaderninho.color.signalSoft,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
  '& button': {
    minHeight: 36,
    borderRadius: nossoCaderninho.radius.control,
  },
});

const commandSpacerClass = css({
  flex: '1 1 12px',
  '@media (max-width: 1120px)': {
    flexBasis: '100%',
    height: 0,
  },
});

const searchClass = css({
  width: 280,
  minWidth: 180,
  '@media (max-width: 899px)': {
    width: '100%',
    order: -1,
  },
});

const filtersClass = css({
  padding: `0 ${nossoCaderninho.space.lg}px ${nossoCaderninho.space.sm}px`,
  backgroundColor: nossoCaderninho.color.signalSoft,
});

type AccountSyncSidebarProps = {
  account: AccountEntity;
  accountsSyncing: string[];
};

function AccountSyncSidebar({
  account,
  accountsSyncing,
}: AccountSyncSidebarProps) {
  return (
    <View
      style={{
        backgroundColor: accountsSyncing.includes(account.id)
          ? theme.sidebarItemBackgroundPending
          : isAccountFailedSync(account)
            ? theme.sidebarItemBackgroundFailed
            : theme.sidebarItemBackgroundPositive,
        marginRight: '4px',
        width: 8,
        height: 8,
        borderRadius: 8,
      }}
    />
  );
}

type AccountNameFieldProps = {
  account?: AccountEntity;
  accountName: string;
  isNameEditable: boolean;
  saveNameError?: ReactNode;
  onSaveName: (newName: string) => void;
};

function AccountNameField({
  account,
  accountName,
  isNameEditable,
  saveNameError,
  onSaveName,
}: AccountNameFieldProps) {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);

  const handleSave = (newName: string) => {
    onSaveName(newName);
    setEditingName(false);
  };

  return (
    <View style={{ flexShrink: 0, alignItems: 'center' }}>
      {editingName ? (
        <>
          <InitialFocus>
            <Input
              defaultValue={accountName}
              onEnter={handleSave}
              onUpdate={handleSave}
              onEscape={() => setEditingName(false)}
              style={{
                fontSize: 25,
                fontWeight: 500,
                marginTop: -3,
                marginBottom: -4,
                marginLeft: -6,
                paddingTop: 2,
                paddingBottom: 2,
                width: Math.max(20, accountName.length) + 'ch',
              }}
            />
          </InitialFocus>
          {saveNameError && (
            <View style={{ color: theme.warningText }}>{saveNameError}</View>
          )}
        </>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            gap: 3,
            '& .hover-visible': {
              opacity: 0,
              transition: 'opacity .25s',
            },
            '&:hover .hover-visible': {
              opacity: 1,
            },
          }}
        >
          <View
            style={{
              fontSize: 25,
              fontWeight: 500,
              marginRight: 5,
              marginBottom: -1,
            }}
            data-testid="account-name"
          >
            {account && account.closed
              ? t('Closed: {{ accountName }}', { accountName })
              : accountName}
          </View>

          <View style={{ flexDirection: 'row', width: 50 }}>
            {isNameEditable && account && (
              <NotesButton
                id={`account-${account.id}`}
                defaultColor={theme.pageTextSubdued}
              />
            )}
            {isNameEditable && (
              <Button
                variant="bare"
                aria-label={t('Edit account name')}
                className="hover-visible"
                onPress={() => setEditingName(true)}
              >
                <SvgPencil1
                  style={{
                    width: 11,
                    height: 11,
                    color: theme.pageTextSubdued,
                  }}
                />
              </Button>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

type AccountMenuProps = {
  account: AccountEntity;
  canSync: boolean;
  showNetWorthChart: boolean;
  showBalances: boolean;
  canShowBalances: boolean;
  showCleared: boolean;
  showReconciled: boolean;
  isSorted: boolean;
  onMenuSelect: (
    item:
      | 'link'
      | 'unlink'
      | 'close'
      | 'reopen'
      | 'export'
      | 'toggle-balance'
      | 'remove-sorting'
      | 'toggle-cleared'
      | 'toggle-reconciled'
      | 'toggle-net-worth-chart'
      | 'credit-card-settings',
  ) => void;
};

function AccountMenu({
  account,
  canSync,
  showNetWorthChart,
  showBalances,
  canShowBalances,
  showCleared,
  showReconciled,
  isSorted,
  onMenuSelect,
}: AccountMenuProps) {
  const { t } = useTranslation();
  const syncServerStatus = useSyncServerStatus();

  return (
    <Menu
      slot="close"
      onMenuSelect={item => {
        onMenuSelect(item);
      }}
      items={[
        ...(isSorted
          ? [
              {
                name: 'remove-sorting',
                text: t('Remove all sorting'),
              } as const,
            ]
          : []),
        ...(canShowBalances
          ? [
              {
                name: 'toggle-balance',
                text: showBalances
                  ? t('Hide running balance')
                  : t('Show running balance'),
              } as const,
            ]
          : []),
        {
          name: 'toggle-net-worth-chart',
          text: showNetWorthChart
            ? t('Hide balance chart')
            : t('Show balance chart'),
        },
        {
          name: 'toggle-cleared',
          text: showCleared
            ? t('Hide "cleared" checkboxes')
            : t('Show "cleared" checkboxes'),
        },
        {
          name: 'toggle-reconciled',
          text: showReconciled
            ? t('Hide reconciled transactions')
            : t('Show reconciled transactions'),
        },
        { name: 'export', text: t('Export') },
        // Statement tracking (budget-queries.ts) only ever considers
        // on-budget accounts, so the setting is a no-op on an off-budget one
        // — don't offer it there.
        ...(account && !account.closed && !account.offbudget
          ? [
              {
                name: 'credit-card-settings',
                text: t('Credit card settings'),
              } as const,
            ]
          : []),
        ...(account && !account.closed
          ? canSync
            ? [
                {
                  name: 'unlink',
                  text: t('Unlink account'),
                } as const,
              ]
            : syncServerStatus === 'online'
              ? [
                  {
                    name: 'link',
                    text: t('Link account'),
                  } as const,
                ]
              : []
          : []),

        ...(account.closed
          ? [{ name: 'reopen', text: t('Reopen account') } as const]
          : [{ name: 'close', text: t('Close account') } as const]),
      ]}
    />
  );
}
