// @ts-strict-ignore
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import {
  SvgArrowButtonDown1,
  SvgArrowButtonUp1,
} from '@actual-app/components/icons/v2';
import { Popover } from '@actual-app/components/popover';
import { SpaceBetween } from '@actual-app/components/space-between';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { useTrackingBudget } from '#components/budget/tracking/TrackingBudgetContext';
import { NotesButton } from '#components/NotesButton';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useUndo } from '#hooks/useUndo';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { BudgetMonthMenu } from './BudgetMonthMenu';
import { CapacityRail } from './CapacityRail';
import { ExpenseTotal } from './ExpenseTotal';
import { IncomeTotal } from './IncomeTotal';
import { Saved } from './Saved';

type BudgetSummaryProps = {
  month: string;
};
export function BudgetSummary({ month }: BudgetSummaryProps) {
  const locale = useLocale();
  const { t } = useTranslation();
  const {
    currentMonth,
    summaryCollapsed: collapsed,
    onBudgetAction,
    onToggleSummaryCollapse,
  } = useTrackingBudget();

  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const { showUndoNotification } = useUndo();

  function onMenuOpen() {
    setMenuOpen(true);
  }

  function onMenuClose() {
    setMenuOpen(false);
  }

  const ExpandOrCollapseIcon = collapsed
    ? SvgArrowButtonDown1
    : SvgArrowButtonUp1;

  const displayMonth = monthUtils.format(month, "MMMM ''yy", locale);

  return (
    <View
      style={{
        backgroundColor:
          month === currentMonth
            ? theme.budgetCurrentMonth
            : theme.budgetOtherMonth,
        border: '1px solid ' + theme.tableBorder,
        borderRadius: nossoCaderninho.radius.control,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        flex: 1,
        cursor: 'default',
        marginBottom: 8,
        overflow: 'hidden',
        '& .hover-visible': {
          opacity: 0,
          transition: 'opacity .25s',
        },
        '&:hover .hover-visible': {
          opacity: 1,
        },
      }}
    >
      <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
        <View
          style={{
            minHeight: 42,
            padding: '0 13px',
            justifyContent: 'center',
            borderBottom: '1px solid ' + theme.tableBorder,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 10,
              top: 0,
            }}
          >
            <Button
              variant="bare"
              aria-label={
                collapsed
                  ? t('Expand month summary')
                  : t('Collapse month summary')
              }
              className="hover-visible"
              onPress={onToggleSummaryCollapse}
            >
              <ExpandOrCollapseIcon
                width={13}
                height={13}
                // The margin is to make it the exact same size as the dots button
                style={{ color: theme.pageTextLight, margin: 1 }}
              />
            </Button>
          </View>

          <div
            className={css({
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 650,
              textDecorationSkip: 'ink',
            })}
          >
            {monthUtils.format(month, 'MMMM', locale)}
          </div>

          <View
            style={{
              position: 'absolute',
              right: 10,
              top: 0,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View>
              <NotesButton
                id={`budget-${month}`}
                width={15}
                height={15}
                tooltipPosition="bottom right"
                defaultColor={theme.pageTextLight}
              />
            </View>
            <View style={{ userSelect: 'none' }}>
              <Button
                ref={triggerRef}
                variant="bare"
                aria-label={t('Menu')}
                onPress={onMenuOpen}
              >
                <SvgDotsHorizontalTriple
                  width={15}
                  height={15}
                  style={{ color: theme.pageTextLight }}
                />
              </Button>

              <Popover
                triggerRef={triggerRef}
                isOpen={menuOpen}
                onOpenChange={onMenuClose}
              >
                <BudgetMonthMenu
                  onCopyLastMonthBudget={() => {
                    onBudgetAction(month, 'copy-last');
                    onMenuClose();
                    showUndoNotification({
                      message: t(
                        "{{displayMonth}} budgets have all been set to last month's budgeted amounts.",
                        { displayMonth },
                      ),
                    });
                  }}
                  onSetBudgetsToZero={() => {
                    onBudgetAction(month, 'set-zero');
                    onMenuClose();
                    showUndoNotification({
                      message: t(
                        '{{displayMonth}} budgets have all been set to zero.',
                        { displayMonth },
                      ),
                    });
                  }}
                  onSetMonthsAverage={numberOfMonths => {
                    onBudgetAction(month, `set-${numberOfMonths}-avg`);
                    onMenuClose();
                    showUndoNotification({
                      message:
                        numberOfMonths === 12
                          ? t(
                              `${displayMonth} budgets have all been set to yearly average.`,
                            )
                          : t(
                              `${displayMonth} budgets have all been set to ${numberOfMonths} month average.`,
                            ),
                    });
                  }}
                  onCheckTemplates={() => {
                    onBudgetAction(month, 'check-templates');
                    onMenuClose();
                  }}
                  onApplyBudgetTemplates={() => {
                    onBudgetAction(month, 'apply-goal-template');
                    onMenuClose();
                    showUndoNotification({
                      message: t(
                        '{{displayMonth}} budget templates have been applied.',
                        { displayMonth },
                      ),
                    });
                  }}
                  onOverwriteWithBudgetTemplates={() => {
                    onBudgetAction(month, 'overwrite-goal-template');
                    onMenuClose();
                    showUndoNotification({
                      message: t(
                        '{{displayMonth}} budget templates have been overwritten.',
                        { displayMonth },
                      ),
                    });
                  }}
                />
              </Popover>
            </View>
          </View>
        </View>

        <CapacityRail isProjected={month >= currentMonth} />

        {!collapsed && (
          <SpaceBetween
            direction="vertical"
            gap={10}
            style={{
              alignSelf: 'center',
              alignItems: 'flex-start',
              backgroundColor: nossoCaderninho.color.signalSoft,
              border: `1px solid ${nossoCaderninho.color.railSoft}`,
              borderRadius: 0,
              padding: '10px 15px',
              marginTop: 13,
            }}
          >
            <IncomeTotal />
            <ExpenseTotal />
          </SpaceBetween>
        )}

        {!collapsed && (
          <Saved
            projected={month >= currentMonth}
            style={{ marginTop: 13, marginBottom: 20 }}
          />
        )}
      </SheetNameProvider>
    </View>
  );
}
