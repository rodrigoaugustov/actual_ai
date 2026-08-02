import type { ComponentProps, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

import type { CustomReportEntity } from '@actual-app/core/types/models';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomReport } from './CustomReport';
import { GetCardData } from './GetCardData';
import { Spending } from './Spending';
import { SpendingCard } from './SpendingCard';

const testState = vi.hoisted(() => ({
  transferPreference: 'false',
  resolveTransactions: false,
  listeners: new Set<() => void>(),
}));
const factoryMocks = vi.hoisted(() => ({
  spending: vi.fn(() => vi.fn()),
  custom: vi.fn(() => vi.fn()),
  grouped: vi.fn(() => vi.fn()),
}));
const hookMocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  setLocalPref: vi.fn(),
  updateWidget: vi.fn(),
  onApply: vi.fn(),
  onDelete: vi.fn(),
  onUpdate: vi.fn(),
  onConditionsOpChange: vi.fn(),
}));
type PairHookState =
  | { status: 'loading' | 'error'; data: null }
  | { status: 'ready'; data: { first: object; second: object[] } };
const pairHookMock = vi.hoisted((): { state: PairHookState } => ({
  state: { status: 'loading', data: null },
}));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn((command: string) => {
    if (!testState.resolveTransactions) {
      return new Promise(() => undefined);
    }

    return Promise.resolve({
      date:
        command === 'get-earliest-transaction' ? '2026-01-01' : '2026-01-31',
    });
  }),
}));

vi.mock('@actual-app/components/hooks/useResponsive', async importOriginal => ({
  ...(await importOriginal()),
  useResponsive: vi.fn(() => ({ isNarrowWidth: false })),
}));

vi.mock('react-router', async importOriginal => ({
  ...(await importOriginal()),
  useLocation: vi.fn(() => ({ pathname: '/reports/custom/report' })),
  useParams: vi.fn(() => ({ id: 'report' })),
}));

vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: vi.fn((name: string) => {
    if (name === 'budgetType') {
      return ['envelope', vi.fn()];
    }
    if (name === 'firstDayOfWeekIdx') {
      return ['0', vi.fn()];
    }
    const preference = useSyncExternalStore(
      listener => {
        testState.listeners.add(listener);
        return () => testState.listeners.delete(listener);
      },
      () => testState.transferPreference,
    );
    return [preference, vi.fn()];
  }),
}));

vi.mock('#hooks/useDashboardWidget', () => ({
  useDashboardWidget: vi.fn(() => ({ data: undefined, isPending: false })),
}));

vi.mock('#hooks/useReport', () => ({
  useReport: vi.fn(() => ({ data: customReport, isPending: false })),
}));

vi.mock('#hooks/useRuleConditionFilters', () => ({
  useRuleConditionFilters: vi.fn(() => ({
    conditions: [],
    conditionsOp: 'and',
    onApply: hookMocks.onApply,
    onDelete: hookMocks.onDelete,
    onUpdate: hookMocks.onUpdate,
    onConditionsOpChange: hookMocks.onConditionsOpChange,
  })),
}));

vi.mock('#hooks/useCategories', () => ({
  useCategories: vi.fn(() => ({ data: { list: [], grouped: [] } })),
}));
vi.mock('#hooks/usePayees', () => ({
  usePayees: vi.fn(() => ({ data: [] })),
}));
vi.mock('#hooks/useAccounts', () => ({
  useAccounts: vi.fn(() => ({ data: [] })),
}));
vi.mock('#hooks/useLocalPref', () => ({
  useLocalPref: vi.fn(() => [false, hookMocks.setLocalPref]),
}));
vi.mock('#hooks/useLocale', () => ({
  useLocale: vi.fn(() => undefined),
}));
vi.mock('#hooks/useFormat', () => ({
  useFormat: vi.fn(
    () => (value: unknown) =>
      typeof value === 'number' || typeof value === 'string'
        ? String(value)
        : '',
  ),
}));
vi.mock('#hooks/useNavigate', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));
vi.mock('#redux', () => ({
  useDispatch: vi.fn(() => hookMocks.dispatch),
}));
vi.mock('#reports/mutations', () => ({
  useUpdateDashboardWidgetMutation: vi.fn(() => ({
    mutate: hookMocks.updateWidget,
  })),
}));

vi.mock('#components/reports/useReport', () => ({
  useReport: vi.fn(() => null),
  useReportPair: vi.fn(() => pairHookMock.state),
}));
vi.mock('#components/reports/spreadsheets/spending-spreadsheet', () => ({
  createSpendingSpreadsheet: factoryMocks.spending,
}));
vi.mock('#components/reports/spreadsheets/custom-spreadsheet', () => ({
  createCustomSpreadsheet: factoryMocks.custom,
}));
vi.mock('#components/reports/spreadsheets/grouped-spreadsheet', () => ({
  createGroupedSpreadsheet: factoryMocks.grouped,
}));

vi.mock('#components/reports/ReportCard', () => ({
  ReportCard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('#components/reports/ReportCardName', () => ({
  ReportCardName: () => null,
}));
vi.mock('#components/reports/ReportTopbar', () => ({
  ReportTopbar: () => null,
}));
vi.mock('#components/Page', () => ({
  MobilePageHeader: () => null,
  Page: ({ children }: { children: ReactNode }) => children,
  PageHeader: () => null,
}));
vi.mock('#components/reports/DateRange', () => ({
  DateRange: () => null,
}));
vi.mock('#components/reports/LoadingIndicator', () => ({
  LoadingIndicator: () => <div data-testid="report-loading" />,
}));
vi.mock('#components/reports/ChooseGraph', () => ({
  ChooseGraph: () => <div data-testid="choose-graph" />,
}));

const customReport = {
  id: 'report',
  name: 'Report',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  isDateStatic: true,
  dateRange: 'This month',
  mode: 'total',
  groupBy: 'Category',
  interval: 'Monthly',
  balanceType: 'Payment',
  sortBy: 'desc',
  showEmpty: false,
  showOffBudget: false,
  showHiddenCategories: false,
  includeCurrentInterval: true,
  showUncategorized: true,
  trimIntervals: false,
  showTrendLines: false,
  graphType: 'BarGraph',
  conditions: [],
  conditionsOp: 'and',
} satisfies CustomReportEntity;

function expectFactoryRefresh(factories: Array<ReturnType<typeof vi.fn>>) {
  const callCounts = factories.map(factory => factory.mock.calls.length);

  act(() => {
    testState.transferPreference = 'true';
    testState.listeners.forEach(listener => listener());
  });

  factories.forEach((factory, index) => {
    expect(factory.mock.calls.length).toBeGreaterThan(callCounts[index]);
    expect(factory).toHaveBeenLastCalledWith(
      expect.objectContaining({ separateTransfersFromSpending: 'true' }),
    );
  });
}

describe('report transfer preference wiring', () => {
  beforeEach(() => {
    testState.transferPreference = 'false';
    testState.resolveTransactions = false;
    testState.listeners.clear();
    factoryMocks.spending.mockClear();
    factoryMocks.custom.mockClear();
    factoryMocks.grouped.mockClear();
    pairHookMock.state = { status: 'loading', data: null };
    sessionStorage.clear();
  });

  it('refreshes the Spending page factory', () => {
    render(<Spending />);

    expectFactoryRefresh([factoryMocks.spending]);
  });

  it('refreshes the Spending card factory', () => {
    const renderUi = () => (
      <SpendingCard widgetId="spending" meta={{}} onMetaChange={vi.fn()} />
    );
    render(renderUi());

    expectFactoryRefresh([factoryMocks.spending]);
  });

  it('refreshes and reconciles both Custom page factories', () => {
    const renderUi = () => <CustomReport />;
    render(renderUi());

    expectFactoryRefresh([factoryMocks.custom, factoryMocks.grouped]);
  });

  it('refreshes and reconciles both Custom card factories', () => {
    const props: ComponentProps<typeof GetCardData> = {
      report: customReport,
      payees: [],
      accounts: [],
      categories: { list: [], grouped: [] },
      earliestTransaction: '2026-01-01',
      latestTransaction: '2026-01-31',
    };
    const renderUi = () => <GetCardData {...props} />;
    render(renderUi());

    expectFactoryRefresh([factoryMocks.custom, factoryMocks.grouped]);
  });

  it.each([
    ['page', () => <CustomReport />],
    [
      'card',
      () => (
        <GetCardData
          report={customReport}
          payees={[]}
          accounts={[]}
          categories={{ list: [], grouped: [] }}
          earliestTransaction="2026-01-01"
          latestTransaction="2026-01-31"
        />
      ),
    ],
  ] as const)(
    'shows an explicit error instead of partial data on the Custom %s',
    async (_surface, renderUi) => {
      pairHookMock.state = { status: 'error', data: null };
      testState.resolveTransactions = _surface === 'page';

      render(renderUi());

      expect(
        await screen.findByText('There was a problem loading your report'),
      ).toBeVisible();
      expect(screen.queryByTestId('choose-graph')).not.toBeInTheDocument();
    },
  );
});
