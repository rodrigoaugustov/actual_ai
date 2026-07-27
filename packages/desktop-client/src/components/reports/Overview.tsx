import { useCallback, useMemo, useState } from 'react';
import { Dialog, DialogTrigger } from 'react-aria-components';
import { ErrorBoundary } from 'react-error-boundary';
import ReactGridLayout from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useHotkeys } from 'react-hotkeys-hook';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgCog,
  SvgDotsHorizontalTriple,
  SvgMenu,
} from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { View } from '@actual-app/components/view';
import type {
  CustomReportWidget,
  DashboardPageEntity,
  DashboardWidgetEntity,
  ExportImportDashboard,
  MarkdownWidget,
} from '@actual-app/core/types/models';

import { MobilePageHeader, Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import {
  useDashboardPages,
  useDashboardPageWidgets,
} from '#hooks/useDashboardPages';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useNavigate } from '#hooks/useNavigate';
import { useReports } from '#hooks/useReports';
import { useResizeObserver } from '#hooks/useResizeObserver';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import {
  addNotification,
  removeNotification,
} from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import {
  useAddDashboardWidgetMutation,
  useDeleteDashboardPageMutation,
  useImportDashboardPageMutation,
  useResetDashboardPageMutation,
  useUpdateDashboardWidgetMutation,
  useUpdateDashboardWidgetsMutation,
} from '#reports/mutations';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { NON_DRAGGABLE_AREA_CLASS_NAME } from './constants';
import { DashboardHeader } from './DashboardHeader';
import './overview.scss';
import { DashboardSelector } from './DashboardSelector';
import { LoadingIndicator } from './LoadingIndicator';
import { moveDashboardWidget } from './reportLayout';
import { AgeOfMoneyCard } from './reports/AgeOfMoneyCard';
import { BalanceForecastCard } from './reports/BalanceForecastCard';
import { BudgetAnalysisCard } from './reports/BudgetAnalysisCard';
import { CalendarCard } from './reports/CalendarCard';
import { CashFlowCard } from './reports/CashFlowCard';
import { CrossoverCard } from './reports/CrossoverCard';
import { CustomReportListCards } from './reports/CustomReportListCards';
import { FormulaCard } from './reports/FormulaCard';
import { MarkdownCard } from './reports/MarkdownCard';
import { MissingReportCard } from './reports/MissingReportCard';
import { NetWorthCard } from './reports/NetWorthCard';
import { SankeyCard } from './reports/SankeyCard';
import { SpendingCard } from './reports/SpendingCard';
import { SummaryCard } from './reports/SummaryCard';
import { ReportsSheet } from './ReportsSheet';
import {
  reportsCurrentViewClass,
  reportsDesktopHeaderClass,
  reportsEmptyStateClass,
  reportsGridClass,
  reportsGridItemClass,
  reportsHeaderActionsClass,
  reportsHeaderIdentityClass,
  reportsMenuClass,
  reportsMobileHeaderButtonClass,
  reportsMobileWidgetToolbarClass,
  reportsOrganizeClass,
  reportsStageClass,
  reportsStageHeadingClass,
  reportsSurfaceClass,
  reportsWorkbenchClass,
} from './reportsStyles';
import { ReportsWorkbenchNav } from './ReportsWorkbenchNav';

function isCustomReportWidget(
  widget: DashboardWidgetEntity,
): widget is CustomReportWidget {
  return widget.type === 'custom-report';
}

function getWidgetMinHeight(widget: DashboardWidgetEntity) {
  if (
    isCustomReportWidget(widget) ||
    widget.type === 'markdown-card' ||
    widget.type === 'formula-card' ||
    widget.type === 'summary-card'
  ) {
    return 1;
  }

  if (widget.type === 'sankey-card') {
    return 3;
  }

  return 2;
}

function getWidgetMinWidth(widget: DashboardWidgetEntity) {
  if (widget.type === 'formula-card') {
    return 1;
  }

  if (isCustomReportWidget(widget) || widget.type === 'markdown-card') {
    return 2;
  }

  return 3;
}

type OverviewProps = {
  dashboard: DashboardPageEntity;
};

/*
THESIS — Análises é uma bancada de leitura; recusa o mosaico de KPIs como destino.
OWN-WORLD — Esmalte frio, placas brancas e trilhos finos alinham gráficos, valores e provas.
STORY — A família abre uma visão, entende o que mudou e aprofunda uma análise sem perder contexto.
FIRST VIEWPORT — Biblioteca vertical, resumo compacto e widgets contínuos; organizar fica secundário.
FORM — Oficina de relatórios, posição 5; composição B + visão geral A; seed 3d6425c9.
*/
export function Overview({ dashboard }: OverviewProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [_firstDayOfWeekIdx] = useSyncedPref('firstDayOfWeekIdx');
  const firstDayOfWeekIdx = _firstDayOfWeekIdx || '0';
  const budgetAnalysisReportEnabled = useFeatureFlag('budgetAnalysisReport');
  const balanceForecastReportEnabled = useFeatureFlag('balanceForecastReport');

  const formulaMode = useFeatureFlag('formulaMode');

  const [isImporting, setIsImporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const { isNarrowWidth } = useResponsive();
  const { data: customReports = [], isPending: isCustomReportsLoading } =
    useReports();

  const sankeyFeatureFlag = useFeatureFlag('sankeyReport');

  const customReportMap = useMemo(
    () => new Map(customReports.map(report => [report.id, report])),
    [customReports],
  );
  const { data: dashboardPages = [], isPending: isDashboardPageLoading } =
    useDashboardPages();

  const { data: widgets = [], isPending: isWidgetsLoading } =
    useDashboardPageWidgets(dashboard.id);

  const isLoading =
    isCustomReportsLoading || isWidgetsLoading || isDashboardPageLoading;

  const navigate = useNavigate();

  const location = useLocation();
  sessionStorage.setItem('url', location.pathname);

  const [containerWidth, setContainerWidth] = useState(0);
  const [workbenchWidth, setWorkbenchWidth] = useState(0);
  const handleWorkbenchResize = useCallback((contentRect: DOMRectReadOnly) => {
    setWorkbenchWidth(Math.floor(contentRect.width));
  }, []);
  const workbenchRef = useResizeObserver<HTMLDivElement>(handleWorkbenchResize);
  const isWorkbenchNarrow =
    isNarrowWidth || (workbenchWidth > 0 && workbenchWidth < 900);
  const currentBreakpoint: 'mobile' | 'desktop' =
    isNarrowWidth || (containerWidth > 0 && containerWidth < 680)
      ? 'mobile'
      : 'desktop';
  const handleResize = useCallback((contentRect: DOMRectReadOnly) => {
    setContainerWidth(Math.floor(contentRect.width));
  }, []);
  const containerRef = useResizeObserver<HTMLDivElement>(handleResize);
  const isMounted = containerWidth > 0;

  const mobileLayout = useMemo(() => {
    if (!widgets || widgets.length === 0) {
      return [];
    }

    const sortedDesktopItems = [...widgets];

    // Sort to ensure that items are ordered top-to-bottom, and for items on the same row, left-to-right
    sortedDesktopItems.sort((a, b) => {
      if (a.y < b.y) return -1;
      if (a.y > b.y) return 1;
      if (a.x < b.x) return -1;
      if (a.x > b.x) return 1;
      return 0;
    });

    let currentY = 0;
    return sortedDesktopItems.map(widget => {
      const displayHeight =
        !isEditing &&
        (widget.type === 'formula-card' || widget.type === 'summary-card')
          ? 1
          : Math.max(getWidgetMinHeight(widget), widget.height);
      const itemY = currentY;
      currentY += displayHeight;

      return {
        i: widget.id,
        x: 0,
        y: itemY, // Calculate correct y co-ordinate to prevent react-grid-layout's auto-compacting behaviour
        w: 1,
        h: displayHeight,
      };
    });
  }, [isEditing, widgets]);

  const desktopLayout = useMemo(() => {
    if (!widgets) return [];
    return widgets.map(widget => {
      const displayHeight =
        !isEditing &&
        (widget.type === 'formula-card' || widget.type === 'summary-card')
          ? 1
          : widget.height;

      return {
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.width,
        h: displayHeight,
        minW: getWidgetMinWidth(widget),
        minH: getWidgetMinHeight(widget),
      };
    });
  }, [isEditing, widgets]);

  const currentLayout = useMemo(
    () => (currentBreakpoint === 'desktop' ? desktopLayout : mobileLayout),
    [currentBreakpoint, desktopLayout, mobileLayout],
  );

  const widgetMap = useMemo(
    () => new Map((widgets ?? []).map(widget => [widget.id, widget])),
    [widgets],
  );

  const closeNotifications = () => {
    dispatch(removeNotification({ id: 'import' }));
  };

  // Close import notifications when doing "undo" operation
  useHotkeys(
    'ctrl+z, cmd+z, meta+z',
    closeNotifications,
    {
      scopes: ['app'],
    },
    [closeNotifications],
  );

  const { undo } = useUndo();

  const onDispatchSucessNotification = (message: string) => {
    dispatch(
      addNotification({
        notification: {
          id: 'import',
          type: 'message',
          sticky: true,
          timeout: 30_000, // 30s
          message,
          messageActions: {
            undo: () => {
              closeNotifications();
              undo();
            },
          },
        },
      }),
    );
  };

  const resetDashboardPageMutation = useResetDashboardPageMutation();

  const onResetDashboard = async () => {
    setIsImporting(true);

    resetDashboardPageMutation.mutate(
      {
        id: dashboard.id,
      },
      {
        onSettled: () => {
          setIsImporting(false);
        },
        onSuccess: () => {
          onDispatchSucessNotification(
            t(
              "Dashboard has been successfully reset to default state. Don't like what you see? You can always press [ctrl+z](#undo) to undo.",
            ),
          );
        },
      },
    );
  };

  const updateDashboardWidgetsMutation = useUpdateDashboardWidgetsMutation();

  const onLayoutChange = (newLayout: Layout) => {
    if (!isEditing) {
      return;
    }

    updateDashboardWidgetsMutation.mutate({
      widgets: newLayout.map(item => ({
        id: item.i,
        width: item.w,
        height: item.h,
        x: item.x,
        y: item.y,
      })),
    });
  };

  const addDashboardWidgetMutation = useAddDashboardWidgetMutation();

  const onAddWidget = <T extends DashboardWidgetEntity>(
    type: T['type'],
    meta: T['meta'] = null,
  ) => {
    addDashboardWidgetMutation.mutate({
      widget: {
        type,
        width: 4,
        height: type === 'sankey-card' ? 3 : 2,
        meta,
        dashboard_page_id: dashboard.id,
      },
    });
  };

  const onExport = () => {
    const data = {
      version: 1,
      widgets: desktopLayout.map(item => {
        const widget = widgetMap.get(item.i);

        if (!widget) {
          throw new Error(`Unable to query widget: ${item.i}`);
        }

        if (isCustomReportWidget(widget)) {
          const customReport = customReportMap.get(widget.meta.id);

          if (!customReport) {
            throw new Error(`Custom report not found for widget: ${item.i}`);
          }

          return {
            ...widget,
            meta: customReport,
            id: undefined,
            tombstone: undefined,
          };
        }

        return { ...widget, id: undefined, tombstone: undefined };
      }),
    } satisfies ExportImportDashboard;

    void window.Actual.saveFile(
      JSON.stringify(data, null, 2),
      'dashboard.json',
      t('Export Dashboard'),
    );
  };

  const importDashboardPageMutation = useImportDashboardPageMutation();

  const onImport = async () => {
    const openFileDialog = window.Actual.openFileDialog;

    if (!openFileDialog) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Fatal error occurred: unable to open import file dialog.',
            ),
          },
        }),
      );
      return;
    }

    const [filePath] = await openFileDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'JSON files',
          extensions: ['json'],
        },
      ],
    });

    closeNotifications();
    setIsImporting(true);

    importDashboardPageMutation.mutate(
      {
        filePath,
        dashboardPageId: dashboard.id,
      },
      {
        onSettled: () => {
          setIsImporting(false);
        },
        onSuccess: () => {
          onDispatchSucessNotification(
            t(
              "Dashboard has been successfully imported. Don't like what you see? You can always press [ctrl+z](#undo) to undo.",
            ),
          );
        },
        onError: error => {
          const originalError = error.cause;
          if (originalError instanceof Error) {
            switch (originalError.cause) {
              case 'json-parse-error':
                dispatch(
                  addNotification({
                    notification: {
                      id: 'import',
                      type: 'error',
                      message: t('Failed parsing the imported JSON.'),
                    },
                  }),
                );
                break;

              case 'validation-error':
                dispatch(
                  addNotification({
                    notification: {
                      id: 'import',
                      type: 'error',
                      message: error.message,
                    },
                  }),
                );
                break;

              default:
                dispatch(
                  addNotification({
                    notification: {
                      id: 'import',
                      type: 'error',
                      message: t('Failed importing the dashboard file.'),
                    },
                  }),
                );
                break;
            }
          }
        },
      },
    );
  };

  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();

  const onMetaChange = (
    widget: { i: string },
    newMeta: DashboardWidgetEntity['meta'],
  ) => {
    updateDashboardWidgetMutation.mutate({
      widget: {
        id: widget.i,
        meta: newMeta,
      },
    });
  };

  const deleteDashboardPageMutation = useDeleteDashboardPageMutation();

  const onDeleteDashboard = async (id: string) => {
    deleteDashboardPageMutation.mutate(
      { id },
      {
        onSuccess: () => {
          const nextDashboard = dashboardPages.find(d => d.id !== id);
          // NOTE: This should hold since invariant dashboard_pages > 1
          if (nextDashboard) {
            void navigate(`/reports/${nextDashboard.id}`);
          }
        },
      },
    );
  };

  const { data: accounts = [] } = useAccounts();
  const updateWidgetGeometry = (
    geometry: Array<{
      id: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }>,
  ) => {
    updateDashboardWidgetsMutation.mutate({ widgets: geometry });
  };
  const moveWidget = (widgetId: string, direction: -1 | 1) => {
    const geometry = moveDashboardWidget(widgets, widgetId, direction);
    if (geometry) {
      updateWidgetGeometry(geometry);
    }
  };
  const resizeWidget = (widgetId: string, direction: -1 | 1) => {
    updateWidgetGeometry(
      widgets.map(widget => ({
        id: widget.id,
        width: widget.width,
        height:
          widget.id === widgetId
            ? Math.max(getWidgetMinHeight(widget), widget.height + direction)
            : widget.height,
        x: widget.x,
        y: widget.y,
      })),
    );
  };

  if (isLoading) {
    return <LoadingIndicator message={t('Loading reports...')} />;
  }

  const addWidgetControl = (
    <DialogTrigger>
      <Button
        variant="primary"
        isDisabled={isImporting}
        style={{
          color: nossoCaderninho.color.navText,
          backgroundColor: nossoCaderninho.color.partnershipSurface,
          borderColor: nossoCaderninho.color.partnership,
        }}
      >
        <Trans>Add analysis</Trans>
      </Button>

      <Popover>
        <Dialog>
          <Menu
            className={reportsMenuClass}
            slot="close"
            onMenuSelect={item => {
              if (item === 'custom-report') {
                void navigate('/reports/custom');
                return;
              }

              function isExistingCustomReport(
                name: string,
              ): name is `custom-report-${string}` {
                return name.startsWith('custom-report-');
              }
              if (isExistingCustomReport(item)) {
                const [, reportId] = item.split('custom-report-');
                onAddWidget<CustomReportWidget>('custom-report', {
                  id: reportId,
                });
                return;
              }

              if (item === 'markdown-card') {
                onAddWidget<MarkdownWidget>(item, {
                  content: `### ${t('Text Widget')}\n\n${t('Edit this widget to change the **markdown** content.')}`,
                });
                return;
              }

              onAddWidget(item);
            }}
            items={[
              {
                name: 'cash-flow-card' as const,
                text: t('Cash flow graph'),
              },
              {
                name: 'net-worth-card' as const,
                text: t('Net worth graph'),
              },
              {
                name: 'crossover-card' as const,
                text: t('Crossover point'),
              },
              {
                name: 'age-of-money-card' as const,
                text: t('Age of Money'),
              },
              {
                name: 'spending-card' as const,
                text: t('Spending analysis'),
              },
              ...(budgetAnalysisReportEnabled
                ? [
                    {
                      name: 'budget-analysis-card' as const,
                      text: t('Budget analysis'),
                    },
                  ]
                : []),
              ...(balanceForecastReportEnabled
                ? [
                    {
                      name: 'balance-forecast-card' as const,
                      text: t('Balance forecast'),
                    },
                  ]
                : []),
              {
                name: 'markdown-card' as const,
                text: t('Text widget'),
              },
              {
                name: 'summary-card' as const,
                text: t('Summary card'),
              },
              {
                name: 'calendar-card' as const,
                text: t('Calendar card'),
              },
              ...(formulaMode
                ? [
                    {
                      name: 'formula-card' as const,
                      text: t('Formula card'),
                    },
                  ]
                : []),
              ...(sankeyFeatureFlag
                ? [
                    {
                      name: 'sankey-card' as const,
                      text: t('Sankey card'),
                    },
                  ]
                : []),
              {
                name: 'custom-report' as const,
                text: t('New custom report'),
              },
              ...(customReports.length
                ? ([Menu.line] satisfies Array<typeof Menu.line>)
                : []),
              ...customReports.map(report => ({
                name: `custom-report-${report.id}` as const,
                text: report.name,
              })),
            ]}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
  const editControl = isEditing ? (
    <Button
      isDisabled={isImporting}
      style={{
        color: nossoCaderninho.color.graphite,
        backgroundColor: nossoCaderninho.color.plate,
        borderColor: nossoCaderninho.color.rail,
      }}
      onPress={() => {
        setIsEditing(false);
        if (isOrganizerOpen) {
          setIsOrganizerOpen(false);
        }
      }}
    >
      <Trans>Finish organizing</Trans>
    </Button>
  ) : (
    <Button
      isDisabled={isImporting}
      style={{
        color: nossoCaderninho.color.graphite,
        backgroundColor: nossoCaderninho.color.plate,
        borderColor: nossoCaderninho.color.rail,
      }}
      onPress={() => {
        setIsEditing(true);
        if (isOrganizerOpen) {
          setIsOrganizerOpen(false);
        }
      }}
    >
      <Trans>Organize</Trans>
    </Button>
  );
  const dashboardMenuControl = (
    <DialogTrigger>
      <Button
        variant="bare"
        aria-label={t('More view options')}
        style={{ color: nossoCaderninho.color.partnership }}
      >
        <SvgDotsHorizontalTriple
          width={15}
          height={15}
          style={{ transform: 'rotateZ(90deg)' }}
        />
      </Button>
      <Popover>
        <Dialog>
          <Menu
            className={reportsMenuClass}
            slot="close"
            onMenuSelect={item => {
              switch (item) {
                case 'reset':
                  void onResetDashboard();
                  break;
                case 'export':
                  onExport();
                  break;
                case 'import':
                  void onImport();
                  break;
                case 'delete':
                  void onDeleteDashboard(dashboard.id);
                  break;
                default:
                  throw new Error(`Unrecognized menu option: ${String(item)}`);
              }
            }}
            items={[
              {
                name: 'reset',
                text: t('Reset to default'),
                disabled: isImporting,
              },
              Menu.line,
              {
                name: 'import',
                text: t('Import'),
                disabled: isImporting,
              },
              {
                name: 'export',
                text: t('Export'),
                disabled: isImporting,
              },
              Menu.line,
              {
                name: 'delete',
                text: t('Delete dashboard'),
                disabled: isImporting || dashboardPages.length <= 1,
              },
            ]}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
  const dashboardControls = (
    <div className={reportsHeaderActionsClass} data-mobile={isNarrowWidth}>
      <DashboardSelector
        dashboards={dashboardPages}
        currentDashboard={dashboard}
      />
      {addWidgetControl}
      {editControl}
      {dashboardMenuControl}
    </div>
  );
  const compactDesktopControls = (
    <div className={reportsHeaderActionsClass}>
      <Button
        id="reports-library-trigger"
        variant="bare"
        aria-label={t('Browse analyses')}
        aria-haspopup="dialog"
        aria-expanded={isLibraryOpen}
        className={reportsMobileHeaderButtonClass}
        style={{ color: nossoCaderninho.color.partnership }}
        onPress={() => setIsLibraryOpen(true)}
      >
        <SvgMenu width={18} height={18} />
      </Button>
      {addWidgetControl}
      <Button
        id="reports-organizer-trigger"
        variant="bare"
        aria-label={t('Organize analyses')}
        aria-haspopup="dialog"
        aria-expanded={isOrganizerOpen}
        className={reportsMobileHeaderButtonClass}
        style={{ color: nossoCaderninho.color.partnership }}
        onPress={() => setIsOrganizerOpen(true)}
      >
        <SvgCog width={18} height={18} />
      </Button>
    </div>
  );

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={t('Analyses')}
            style={{
              backgroundColor: nossoCaderninho.color.nav,
              color: nossoCaderninho.color.navText,
              fontFamily: nossoCaderninho.font.family,
            }}
            leftContent={
              <Button
                id="reports-library-trigger"
                variant="bare"
                aria-label={t('Browse analyses')}
                aria-haspopup="dialog"
                aria-expanded={isLibraryOpen}
                className={reportsMobileHeaderButtonClass}
                onPress={() => setIsLibraryOpen(true)}
              >
                <SvgMenu width={18} height={18} />
              </Button>
            }
            rightContent={
              <Button
                id="reports-organizer-trigger"
                variant="bare"
                aria-label={t('Organize analyses')}
                aria-haspopup="dialog"
                aria-expanded={isOrganizerOpen}
                className={reportsMobileHeaderButtonClass}
                onPress={() => setIsOrganizerOpen(true)}
              >
                <SvgCog width={18} height={18} />
              </Button>
            }
          />
        ) : (
          <View className={reportsDesktopHeaderClass}>
            <div className={reportsHeaderIdentityClass}>
              <h1>
                <Trans>Analyses</Trans>
              </h1>
              <p>
                <Trans>The financial history of our household</Trans>
              </p>
            </div>

            {isWorkbenchNarrow ? compactDesktopControls : dashboardControls}
          </View>
        )
      }
      padding={0}
      style={{
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: nossoCaderninho.color.enamel,
      }}
    >
      <div ref={workbenchRef} className={reportsSurfaceClass}>
        <div
          className={reportsWorkbenchClass}
          data-library-hidden={isNarrowWidth || isWorkbenchNarrow}
        >
          {!isNarrowWidth && !isWorkbenchNarrow && (
            <ReportsWorkbenchNav
              dashboardId={dashboard.id}
              hasBudgetAnalysis={budgetAnalysisReportEnabled}
              hasBalanceForecast={balanceForecastReportEnabled}
              hasSankey={sankeyFeatureFlag}
            />
          )}
          <section
            className={reportsStageClass}
            aria-label={t('Current analysis')}
          >
            <div className={reportsStageHeadingClass}>
              <div>
                <h2>{dashboard.name}</h2>
                <p>
                  <Trans>A shared reading of the household finances</Trans>
                </p>
              </div>
              {isEditing && (
                <strong>
                  <Trans>Organizing view</Trans>
                </strong>
              )}
            </div>
            {isImporting ? (
              <LoadingIndicator message={t('Import is running...')} />
            ) : widgets.length === 0 ? (
              <div className={reportsEmptyStateClass}>
                <h2>
                  <Trans>This view is ready for its first analysis</Trans>
                </h2>
                <p>
                  <Trans>
                    Add a graph, comparison or saved report to start reading the
                    household history.
                  </Trans>
                </p>
                {addWidgetControl}
              </div>
            ) : (
              <div className={`${reportsGridClass} reports-workshop-grid`}>
                <View
                  data-testid="reports-overview"
                  innerRef={containerRef}
                  style={{ userSelect: 'none' }}
                >
                  {isMounted && (
                    <ReactGridLayout
                      width={containerWidth}
                      layout={currentLayout}
                      gridConfig={{
                        cols: currentBreakpoint === 'desktop' ? 12 : 1,
                        rowHeight: 100,
                      }}
                      dragConfig={{
                        enabled: currentBreakpoint === 'desktop' && isEditing,
                        cancel: `.${NON_DRAGGABLE_AREA_CLASS_NAME}`,
                      }}
                      resizeConfig={{
                        enabled: currentBreakpoint === 'desktop' && isEditing,
                      }}
                      onLayoutChange={
                        currentBreakpoint === 'desktop'
                          ? onLayoutChange
                          : undefined
                      }
                    >
                      {currentLayout.map((item, itemIndex) => {
                        const widget = widgetMap.get(item.i);

                        if (!widget) {
                          return null;
                        }

                        return (
                          <div
                            key={item.i}
                            className={reportsGridItemClass}
                            data-mobile-editing={
                              currentBreakpoint === 'mobile' && isEditing
                            }
                          >
                            {currentBreakpoint === 'mobile' && isEditing && (
                              <div className={reportsMobileWidgetToolbarClass}>
                                <span>
                                  {t('Analysis {{current}} of {{total}}', {
                                    current: itemIndex + 1,
                                    total: currentLayout.length,
                                  })}
                                </span>
                                <div>
                                  <Button
                                    variant="bare"
                                    aria-label={t('Move analysis earlier')}
                                    isDisabled={itemIndex === 0}
                                    onPress={() => moveWidget(item.i, -1)}
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    variant="bare"
                                    aria-label={t('Move analysis later')}
                                    isDisabled={
                                      itemIndex === currentLayout.length - 1
                                    }
                                    onPress={() => moveWidget(item.i, 1)}
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    variant="bare"
                                    aria-label={t('Reduce analysis height')}
                                    isDisabled={
                                      widget.height <=
                                      getWidgetMinHeight(widget)
                                    }
                                    onPress={() => resizeWidget(item.i, -1)}
                                  >
                                    −
                                  </Button>
                                  <Button
                                    variant="bare"
                                    aria-label={t('Increase analysis height')}
                                    onPress={() => resizeWidget(item.i, 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </div>
                            )}
                            <ErrorBoundary
                              fallbackRender={() => (
                                <MissingReportCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                >
                                  <Trans>This widget has failed to load.</Trans>
                                </MissingReportCard>
                              )}
                            >
                              {widget.type === 'net-worth-card' ? (
                                <NetWorthCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  accounts={accounts}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'crossover-card' ? (
                                <CrossoverCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  accounts={accounts}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'age-of-money-card' ? (
                                <AgeOfMoneyCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'cash-flow-card' ? (
                                <CashFlowCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'spending-card' ? (
                                <SpendingCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'budget-analysis-card' &&
                                budgetAnalysisReportEnabled ? (
                                <BudgetAnalysisCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'balance-forecast-card' &&
                                balanceForecastReportEnabled ? (
                                <BalanceForecastCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  accounts={accounts}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'markdown-card' ? (
                                <MarkdownCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'custom-report' ? (
                                <CustomReportListCards
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  report={customReportMap.get(widget.meta.id)}
                                />
                              ) : widget.type === 'summary-card' ? (
                                <SummaryCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  isCompact={
                                    !isEditing || currentBreakpoint === 'mobile'
                                  }
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'calendar-card' ? (
                                <CalendarCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  firstDayOfWeekIdx={firstDayOfWeekIdx}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'formula-card' &&
                                formulaMode ? (
                                <FormulaCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : widget.type === 'sankey-card' &&
                                sankeyFeatureFlag ? (
                                <SankeyCard
                                  widgetId={item.i}
                                  isEditing={isEditing}
                                  meta={widget.meta}
                                  onMetaChange={newMeta =>
                                    onMetaChange(item, newMeta)
                                  }
                                />
                              ) : null}
                            </ErrorBoundary>
                          </div>
                        );
                      })}
                    </ReactGridLayout>
                  )}
                </View>
              </div>
            )}
          </section>
        </div>

        <ReportsSheet
          id="reports-library"
          title={<Trans>Analyses library</Trans>}
          subtitle={
            <Trans>Choose what the household wants to understand</Trans>
          }
          isOpen={isLibraryOpen}
          returnFocusId="reports-library-trigger"
          onClose={() => setIsLibraryOpen(false)}
        >
          <ReportsWorkbenchNav
            dashboardId={dashboard.id}
            hasBudgetAnalysis={budgetAnalysisReportEnabled}
            hasBalanceForecast={balanceForecastReportEnabled}
            hasSankey={sankeyFeatureFlag}
            onNavigate={() => setIsLibraryOpen(false)}
          />
        </ReportsSheet>

        <ReportsSheet
          id="reports-organizer"
          title={<Trans>Organize analyses</Trans>}
          subtitle={<Trans>Views, analyses and layout</Trans>}
          isOpen={isOrganizerOpen}
          returnFocusId="reports-organizer-trigger"
          onClose={() => setIsOrganizerOpen(false)}
        >
          <div className={reportsOrganizeClass}>
            <div className={reportsCurrentViewClass}>
              <DashboardHeader dashboard={dashboard} />
            </div>
            {dashboardControls}
          </div>
        </ReportsSheet>
      </div>
    </Page>
  );
}
