import React from 'react';
import type { CSSProperties } from 'react';
import { mergeProps } from 'react-aria';
import type { ListBoxItemRenderProps } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import {
  SvgDelete,
  SvgLeftArrow2,
  SvgRightArrow2,
  SvgSplit,
} from '@actual-app/components/icons/v0';
import {
  SvgArrowsSynchronize,
  SvgCalendar3,
  SvgCheckCircle1,
  SvgLockClosed,
} from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { isPreviewId } from '@actual-app/core/shared/transactions';
import { integerToCurrency } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  AiSuggestionIndexEntry,
  TransactionEntity,
} from '@actual-app/core/types/models';
import {
  PressResponder,
  useLongPress,
  usePress,
} from '@react-aria/interactions';

import { AiOriginBadge } from '#components/ai/AiOriginBadge';
import { makeAmountFullStyle } from '#components/budget/util';
import {
  installmentDisplayNotes,
  InstallmentIndicator,
} from '#components/credit-cards/InstallmentIndicator';
import { useAccount } from '#hooks/useAccount';
import { useCachedSchedules } from '#hooks/useCachedSchedules';
import { useCategories } from '#hooks/useCategories';
import { useDisplayPayee } from '#hooks/useDisplayPayee';
import { usePayee } from '#hooks/usePayee';
import { NotesTagFormatter } from '#notes/NotesTagFormatter';
import { useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { lookupName, Status } from './TransactionEdit';

export const ROW_HEIGHT = 60;

const getTextStyle = ({
  isPreview,
}: {
  isPreview: boolean;
}): CSSProperties => ({
  ...styles.text,
  fontSize: 14,
  ...(isPreview
    ? {
        fontStyle: 'italic',
        color: theme.pageTextLight,
      }
    : {}),
});

const getScheduleIconStyle = ({ isPreview }: { isPreview: boolean }) => ({
  width: 12,
  height: 12,
  marginRight: 5,
  color: isPreview ? theme.pageTextLight : theme.menuItemText,
});

type TransactionListItemProps = ListBoxItemRenderProps & {
  transaction?: TransactionEntity;
  aiSuggestion?: AiSuggestionIndexEntry;
  isResolvingAiSuggestion?: boolean;
  onResolveAiSuggestion?: (
    suggestion: AiSuggestionIndexEntry,
    action: 'accept' | 'reject',
  ) => void;
  showRunningBalance?: boolean;
  runningBalance?: IntegerAmount;
  isReconciling?: boolean;
  onPress: (transaction: TransactionEntity) => void;
  onLongPress: (transaction: TransactionEntity) => void;
  onToggleCleared?: (transaction: TransactionEntity) => void;
};

export function TransactionListItem({
  showRunningBalance,
  runningBalance,
  isReconciling = false,
  onPress,
  onLongPress,
  onToggleCleared,
  transaction,
  aiSuggestion,
  isResolvingAiSuggestion = false,
  onResolveAiSuggestion,
  ...itemProps
}: TransactionListItemProps) {
  const { t } = useTranslation();
  const { data: { list: categories } = { list: [] } } = useCategories();

  const { data: payee } = usePayee(transaction?.payee);
  const displayPayee = useDisplayPayee({ transaction });

  const account = useAccount(transaction?.account || '');
  const transferAccount = useAccount(payee?.transfer_acct || '');
  const isPreview = isPreviewId(transaction?.id || '');

  const newTransactions = useSelector(
    state => state.transactions.newTransactions,
  );

  const { longPressProps } = useLongPress({
    accessibilityDescription: 'Long press to select multiple transactions',
    onLongPress: () => {
      if (isPreview) {
        return;
      }

      onLongPress(transaction!);
    },
  });

  const { pressProps } = usePress({
    onPress: () => {
      onPress(transaction!);
    },
  });

  if (!transaction) {
    return null;
  }

  const {
    id,
    amount,
    category: categoryId,
    cleared: isCleared,
    reconciled: isReconciled,
    is_parent: isParent,
    is_child: isChild,
    notes,
    forceUpcoming,
  } = transaction;

  const previewStatus = forceUpcoming ? 'upcoming' : categoryId;

  const isAdded = newTransactions.includes(id);
  const categoryName = lookupName(categories, categoryId);
  const specialCategory = account?.offbudget
    ? t('Off budget')
    : transferAccount && !transferAccount.offbudget
      ? t('Transfer')
      : isParent
        ? t('Split')
        : null;

  const prettyCategory = specialCategory || categoryName;
  const suggestedCategoryName =
    aiSuggestion?.status === 'pending' && aiSuggestion.categoryId
      ? lookupName(categories, aiSuggestion.categoryId)
      : null;
  const displayedCategory =
    suggestedCategoryName && !specialCategory
      ? t('AI suggests: {{category}}', { category: suggestedCategoryName })
      : prettyCategory || t('Uncategorized');
  const hasDisplayedCategory = Boolean(suggestedCategoryName || prettyCategory);
  const textStyle = getTextStyle({ isPreview });
  const displayedNotes = installmentDisplayNotes(
    notes,
    transaction.installment_num,
    transaction.installment_total,
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        height: ROW_HEIGHT,
        overflow: 'hidden',
        borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
        backgroundColor: itemProps.isSelected
          ? nossoCaderninho.color.partnershipSoft
          : isPreview
            ? nossoCaderninho.color.signalSoft
            : nossoCaderninho.color.plate,
        transition: `background-color ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
      }}
    >
      <PressResponder {...mergeProps(pressProps, longPressProps)}>
        <Button
          {...itemProps}
          style={{
            userSelect: 'none',
            height: '100%',
            flex: 1,
            borderRadius: 0,
            borderWidth: 0,
            ...(isReconciling && { paddingRight: 0 }),
            backgroundColor: itemProps.isSelected
              ? nossoCaderninho.color.partnershipSoft
              : isPreview
                ? nossoCaderninho.color.signalSoft
                : nossoCaderninho.color.plate,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isReconciling ? '0 0 0 4px' : '0 4px',
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <PayeeIcons
                  transaction={transaction}
                  transferAccount={transferAccount}
                />
                <TextOneLine
                  style={{
                    ...textStyle,
                    fontWeight: isAdded ? '650' : '500',
                    ...(!displayPayee && !isPreview
                      ? {
                          color: theme.pageTextLight,
                          fontStyle: 'italic',
                        }
                      : {}),
                  }}
                >
                  {displayPayee || t('(No payee)')}
                </TextOneLine>
              </View>
              {isPreview ? (
                <Status status={previewStatus} isSplit={isParent || isChild} />
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 3,
                  }}
                >
                  {!isReconciling &&
                    (isReconciled ? (
                      <SvgLockClosed
                        style={{
                          width: 11,
                          height: 11,
                          color: theme.noticeTextLight,
                          marginRight: 5,
                        }}
                      />
                    ) : (
                      <SvgCheckCircle1
                        style={{
                          width: 11,
                          height: 11,
                          color: isCleared
                            ? theme.noticeTextLight
                            : theme.pageTextSubdued,
                          marginRight: 5,
                        }}
                      />
                    ))}
                  {(isParent || isChild) && (
                    <SvgSplit
                      style={{
                        width: 12,
                        height: 12,
                        marginRight: 5,
                      }}
                    />
                  )}
                  {transaction.installment_num != null &&
                    transaction.installment_total != null &&
                    transaction.installment_num > 0 &&
                    transaction.installment_total > 0 && (
                      <InstallmentIndicator
                        current={transaction.installment_num}
                        total={transaction.installment_total}
                      />
                    )}
                  {aiSuggestion &&
                    aiSuggestion.status !== 'rejected' &&
                    !specialCategory && (
                      <AiOriginBadge status={aiSuggestion.status} />
                    )}
                  <TextOneLine
                    style={{
                      fontSize: 11,
                      marginLeft:
                        (transaction.installment_num != null &&
                          transaction.installment_total != null) ||
                        (aiSuggestion &&
                          aiSuggestion.status !== 'rejected' &&
                          !specialCategory)
                          ? 5
                          : undefined,
                      marginTop: 1,
                      fontWeight: '400',
                      color: hasDisplayedCategory
                        ? theme.tableText
                        : theme.menuItemTextSelected,
                      fontStyle:
                        specialCategory || !hasDisplayedCategory
                          ? 'italic'
                          : undefined,
                      textAlign: 'left',
                    }}
                  >
                    {displayedCategory}
                  </TextOneLine>
                </View>
              )}
              {displayedNotes && (
                <TextOneLine
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    fontWeight: '400',
                    color: theme.tableText,
                    textAlign: 'left',
                    opacity: 0.85,
                  }}
                >
                  <NotesTagFormatter notes={displayedNotes} />
                </TextOneLine>
              )}
            </View>
            <View style={{ justifyContent: 'center', alignItems: 'flex-end' }}>
              <Text
                style={{
                  ...styles.tnum,
                  ...makeAmountFullStyle(amount, {
                    positiveColor: nossoCaderninho.color.graphite,
                    negativeColor: nossoCaderninho.color.graphite,
                    zeroColor: nossoCaderninho.color.graphiteSubdued,
                  }),
                  ...textStyle,
                }}
              >
                {integerToCurrency(amount)}
              </Text>
              {showRunningBalance && runningBalance !== undefined && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '400',
                    ...styles.tnum,
                    ...makeAmountFullStyle(runningBalance, {
                      positiveColor: theme.numberPositive,
                      negativeColor: theme.numberNegative,
                      zeroColor: theme.numberNeutral,
                    }),
                  }}
                >
                  {integerToCurrency(runningBalance)}
                </Text>
              )}
            </View>
          </View>
        </Button>
      </PressResponder>
      {!isReconciling && !isPreview && aiSuggestion?.status === 'pending' && (
        <MobileAiSuggestionActions
          suggestion={aiSuggestion}
          isLoading={isResolvingAiSuggestion}
          onResolve={onResolveAiSuggestion}
        />
      )}
      {isReconciling &&
        !isPreview &&
        (isChild ? (
          <View
            style={{
              width: 32,
              flexShrink: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ClearedStatusIcon
              isReconciled={isReconciled}
              isCleared={isCleared}
            />
          </View>
        ) : (
          <Button
            variant="bare"
            aria-label={
              isReconciled
                ? t('Unlock reconciled transaction')
                : isCleared
                  ? t('Unclear transaction')
                  : t('Clear transaction')
            }
            style={{
              width: 32,
              height: '100%',
              flexShrink: 0,
              borderRadius: 0,
            }}
            onPress={() => onToggleCleared?.(transaction)}
          >
            <ClearedStatusIcon
              isReconciled={isReconciled}
              isCleared={isCleared}
            />
          </Button>
        ))}
    </View>
  );
}

type MobileAiSuggestionActionsProps = {
  suggestion: AiSuggestionIndexEntry;
  isLoading: boolean;
  onResolve?: (
    suggestion: AiSuggestionIndexEntry,
    action: 'accept' | 'reject',
  ) => void;
};

export function MobileAiSuggestionActions({
  suggestion,
  isLoading,
  onResolve,
}: MobileAiSuggestionActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <ButtonWithLoading
        variant="bare"
        aria-label={t('Accept AI suggestion')}
        style={{
          width: 40,
          height: '100%',
          flexShrink: 0,
          borderRadius: 0,
          color: theme.noticeTextLight,
        }}
        isDisabled={isLoading}
        isLoading={isLoading}
        onPress={() => onResolve?.(suggestion, 'accept')}
      >
        <SvgCheckCircle1 style={{ width: 15, height: 15 }} />
      </ButtonWithLoading>
      <Button
        variant="bare"
        aria-label={t('Reject AI suggestion')}
        style={{
          width: 40,
          height: '100%',
          flexShrink: 0,
          borderRadius: 0,
          color: theme.errorTextMenu,
        }}
        isDisabled={isLoading}
        onPress={() => onResolve?.(suggestion, 'reject')}
      >
        <SvgDelete style={{ width: 13, height: 13 }} />
      </Button>
    </>
  );
}

type ClearedStatusIconProps = {
  isReconciled?: boolean;
  isCleared?: boolean;
};

function ClearedStatusIcon({
  isReconciled,
  isCleared,
}: ClearedStatusIconProps) {
  return isReconciled ? (
    <SvgLockClosed
      style={{
        width: 13,
        height: 13,
        color: theme.noticeTextLight,
      }}
    />
  ) : (
    <SvgCheckCircle1
      style={{
        width: 13,
        height: 13,
        color: isCleared ? theme.noticeTextLight : theme.pageTextSubdued,
      }}
    />
  );
}

type PayeeIconsProps = {
  transaction: TransactionEntity;
  transferAccount?: AccountEntity;
};

function PayeeIcons({ transaction, transferAccount }: PayeeIconsProps) {
  const { id, schedule: scheduleId } = transaction;
  const { isLoading: isSchedulesLoading, schedules = [] } =
    useCachedSchedules();
  const isPreview = isPreviewId(id);
  const schedule = schedules.find(s => s.id === scheduleId);
  const isScheduleRecurring =
    schedule &&
    schedule._date &&
    typeof schedule._date === 'object' &&
    !!schedule._date.frequency;

  if (isSchedulesLoading) {
    return null;
  }

  return (
    <>
      {schedule &&
        (isScheduleRecurring ? (
          <SvgArrowsSynchronize style={getScheduleIconStyle({ isPreview })} />
        ) : (
          <SvgCalendar3 style={getScheduleIconStyle({ isPreview })} />
        ))}
      {transferAccount &&
        (transaction.amount > 0 ? (
          <SvgLeftArrow2 style={{ width: 12, height: 12, marginRight: 5 }} />
        ) : (
          <SvgRightArrow2 style={{ width: 12, height: 12, marginRight: 5 }} />
        ))}
    </>
  );
}
