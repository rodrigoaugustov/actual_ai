import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import type { AccountEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';

import { AiSettings } from '#components/settings/AiSettings';
import { createTestQueryClient, TestProviders } from '#mocks';

import { StatementsPanel } from './StatementsPanel';

const aiSettingsFixture = vi.hoisted(() => ({ isEnabled: false }));

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isNarrowWidth: true,
    isMediumWidth: false,
    isWideWidth: false,
    width: 375,
  }),
}));

vi.mock('#hooks/useCurrentAccess', () => ({
  useCurrentAccess: () => ({ cloudFileId: 'file-1' }),
}));

vi.mock('#hooks/useNavigate', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(async (method: string) => {
    switch (method) {
      case 'ai/get-config':
        return {
          enabled: aiSettingsFixture.isEnabled,
          tiers: {
            fast: { provider: 'openai', model: 'gpt-fast' },
            standard: { provider: 'anthropic', model: 'claude-standard' },
            frontier: { provider: 'google', model: 'gemini-frontier' },
          },
          confidenceThreshold: 0.8,
          redactPii: true,
        };
      case 'ai/get-usage-summary':
        return { totalCostUsd: 0, byAgent: {} };
      case 'ai/get-secrets-status':
        return {};
      case 'ai/get-category-profiles':
        return [];
      case 'get-categories':
        return { grouped: [], list: [] };
      case 'ai/get-suggestions':
        return [];
      case 'credit-card/get-statements':
        return [
          {
            id: 'statement-1',
            acct: 'account-1',
            start_date: '2026-07-01',
            end_date: '2026-07-31',
            due_date: '2026-08-08',
            budget_month: 202608,
            paid_transaction: null,
            tombstone: 0,
            pluggy_bill_id: null,
            status: 'open',
            balance: -12345,
          },
        ];
      default:
        throw new Error(`Unexpected method: ${method}`);
    }
  }),
}));

const account = {
  id: 'account-1',
  name: 'Credit card',
  offbudget: 0,
  closed: 0,
  sort_order: 0,
  last_reconciled: null,
  tombstone: 0,
  closing_day: 31,
  due_day: 8,
  account_id: null,
  bank: null,
  bankName: null,
  bankId: null,
  mask: null,
  official_name: null,
  balance_current: null,
  balance_available: null,
  balance_limit: null,
  account_sync_source: null,
  last_sync: null,
  bank_sync_status: null,
} satisfies AccountEntity;

describe('mobile AI settings and credit-card surfaces', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  function renderPage(page: ReactNode) {
    return render(
      <TestProviders queryClient={createTestQueryClient()}>
        <MemoryRouter>{page}</MemoryRouter>
      </TestProviders>,
    );
  }

  beforeEach(() => {
    aiSettingsFixture.isEnabled = false;
  });

  it('stacks AI tier controls at narrow widths', async () => {
    renderPage(<AiSettings />);

    const fastModel = await screen.findByDisplayValue('gpt-fast');
    expect(fastModel).toHaveStyle({ width: '100%' });
    expect(screen.getByRole('button', { name: 'OpenAI' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Save AI settings' }),
    ).toBeVisible();
  });

  it('keeps operational AI reviews outside configuration', async () => {
    aiSettingsFixture.isEnabled = true;
    renderPage(<AiSettings />);

    await screen.findByDisplayValue('gpt-fast');
    expect(screen.getByRole('button', { name: 'Save API keys' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Open AI operations' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Rule proposals/)).not.toBeInTheDocument();
    expect(screen.queryByText('Mined rule health')).not.toBeInTheDocument();
  });

  it('keeps statements and the installment action reachable on mobile', async () => {
    renderPage(<StatementsPanel account={account} onApplyFilter={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'New installment purchase' }),
    ).toBeVisible();
    expect(await screen.findByText('Jul 2026')).toBeVisible();
    expect(screen.getByText('Open')).toBeVisible();
  });
});
