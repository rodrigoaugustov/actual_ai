import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { CalendarCard } from './CalendarCard';

const calendarReport = vi.hoisted(() => ({
  calendarData: [
    {
      start: new Date(2026, 0, 1),
      end: new Date(2026, 0, 31),
      data: [],
      totalIncome: 100,
      totalExpense: -40,
    },
  ],
}));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('@actual-app/components/hooks/useResponsive', async importOriginal => ({
  ...(await importOriginal()),
  useResponsive: vi.fn(() => ({ isNarrowWidth: false })),
}));

vi.mock('@actual-app/components/tooltip', () => ({
  Tooltip: ({
    children,
    content,
  }: {
    children: ReactNode;
    content: ReactNode;
  }) => (
    <>
      {content}
      {children}
    </>
  ),
}));

vi.mock('#components/reports/useReport', () => ({
  useReport: vi.fn(() => calendarReport),
}));

vi.mock('#components/reports/graphs/CalendarGraph', () => ({
  CalendarGraph: () => <div data-testid="calendar-graph" />,
}));
vi.mock('#components/reports/ReportCard', () => ({
  ReportCard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('#components/reports/ReportCardName', () => ({
  ReportCardName: () => null,
}));
vi.mock('#components/reports/DateRange', () => ({
  DateRange: () => <span>Date range</span>,
}));
vi.mock('#hooks/useFormat', () => ({
  useFormat: vi.fn(
    () => (value: unknown) =>
      typeof value === 'number' || typeof value === 'string'
        ? String(value)
        : '',
  ),
}));
vi.mock('#hooks/useMergedRefs', () => ({
  useMergedRefs: vi.fn(() => vi.fn()),
}));
vi.mock('#hooks/useNavigate', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));
vi.mock('#hooks/useResizeObserver', () => ({
  useResizeObserver: vi.fn(() => vi.fn()),
}));

describe('CalendarCard cash-flow vocabulary', () => {
  it('renders Calendar-specific Inflow/Outflow copy and accessible names', () => {
    render(
      <TestProviders>
        <CalendarCard widgetId="calendar" onMetaChange={vi.fn()} />
      </TestProviders>,
    );

    expect(screen.getByText('Inflow:')).toBeVisible();
    expect(screen.getByText('Outflow:')).toBeVisible();
    expect(screen.getByLabelText('Inflow')).toBeInTheDocument();
    expect(screen.getByLabelText('Outflow')).toBeInTheDocument();
    expect(screen.queryByText('Income:')).not.toBeInTheDocument();
    expect(screen.queryByText('Expenses:')).not.toBeInTheDocument();
  });
});
