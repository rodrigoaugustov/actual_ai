import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import { send } from '@actual-app/core/platform/client/connection';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient, TestProviders } from '#mocks';

import { MobileAiUsagePage } from './AiUsagePage';
import { PendingAiReviewNotice } from './PendingAiReviewNotice';
import { MobilePendingCategorizationsPage } from './PendingCategorizationsPage';
import { RuleHealthPanel } from './RuleHealthPanel';
import { SuggestionsInbox } from './SuggestionsInbox';

const aiListFixture = vi.hoisted(() => ({ failRuleHealth: false }));

vi.mock('#hooks/useCategories', () => ({
  useCategoriesById: () => ({
    data: {
      list: {
        'category-1': { id: 'category-1', name: 'Groceries' },
      },
    },
  }),
}));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(async (method: string) => {
    switch (method) {
      case 'ai/get-runs':
        return [
          {
            id: 'run-1',
            agent: 'advisor',
            tier: 'standard',
            provider: 'openai',
            model: 'gpt-test',
            inputTokens: 1200,
            outputTokens: 300,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            costUsd: 0.0123,
            durationMs: 2400,
            status: 'ok',
            createdAt: new Date(2026, 6, 25, 10, 30).getTime(),
          },
        ];
      case 'ai/get-suggestions':
        return [
          {
            id: 'suggestion-1',
            transactionId: 'transaction-1',
            categoryId: 'category-1',
            confidence: 0.82,
            rationale: 'Similar purchases were categorized as groceries.',
            status: 'pending',
            createdAt: 1,
            accountName: 'Checking',
            payeeName: 'Market',
            notes: 'Weekly shop',
            amount: -4250,
            date: '2026-07-24',
          },
        ];
      case 'ai/get-rule-proposals':
        return [
          {
            id: 'proposal-1',
            ruleId: null,
            payeeName: 'Market',
            op: 'contains',
            value: 'MARKET',
            categoryId: 'category-1',
            rationale: 'The last purchases used the same category.',
            sampleTransactionIds: ['transaction-1'],
            sampleTransactions: [
              {
                id: 'transaction-1',
                date: '2026-07-24',
                amount: -4250,
                payeeName: 'Market',
                importedPayee: 'MARKET STORE 12',
                accountName: 'Checking',
              },
            ],
            status: 'proposed',
            hits: 0,
            confirmed: 0,
            corrected: 0,
            createdAt: 1,
          },
          {
            id: 'proposal-2',
            ruleId: null,
            payeeName: 'Transit',
            op: 'contains',
            value: 'TRANSIT',
            categoryId: 'category-1',
            rationale: 'The last rides used the same category.',
            sampleTransactionIds: ['transaction-2'],
            sampleTransactions: [
              {
                id: 'transaction-2',
                date: '2026-07-23',
                amount: -1800,
                payeeName: 'Transit',
                importedPayee: 'TRANSIT RIDE',
                accountName: 'Checking',
              },
            ],
            status: 'proposed',
            hits: 0,
            confirmed: 0,
            corrected: 0,
            createdAt: 1,
          },
        ];
      case 'ai/get-rule-health':
        if (aiListFixture.failRuleHealth) {
          throw new Error('rule health unavailable');
        }
        return [];
      case 'ai/resolve-suggestion':
      case 'ai/resolve-rule-proposal':
        return undefined;
      default:
        throw new Error(`Unexpected AI method: ${method}`);
    }
  }),
}));

describe('mobile AI list pages', () => {
  function renderPage(page: ReactNode) {
    return render(
      <TestProviders queryClient={createTestQueryClient()}>
        <MemoryRouter>{page}</MemoryRouter>
      </TestProviders>,
    );
  }

  beforeEach(() => {
    aiListFixture.failRuleHealth = false;
  });

  it('renders AI usage as labeled cards instead of a wide table', async () => {
    renderPage(<MobileAiUsagePage />);

    expect(screen.getByRole('heading', { name: 'AI Usage' })).toBeVisible();
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent === 'openai · gpt-test',
      ),
    ).toBeVisible();
    expect(screen.getByText('Tokens in → out')).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' && element.textContent === '1,200 → 300',
      ),
    ).toBeVisible();
  });

  it('renders pending suggestions as cards with reachable actions', async () => {
    const user = userEvent.setup();
    renderPage(<MobilePendingCategorizationsPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Pending AI Categorizations',
      }),
    ).toBeVisible();
    expect(await screen.findByText('Market')).toBeVisible();
    expect(screen.getByText('Groceries')).toBeVisible();
    expect(screen.getByText('High · 82%')).toBeVisible();
    expect(
      screen.getByText('Similar purchases were categorized as groceries.'),
    ).toBeVisible();
    expect(screen.getByText('Automation and rule health')).toBeVisible();
    expect(screen.getByText(/^Rule proposals/)).toBeVisible();
    expect(screen.getAllByText('Sample transactions')).toHaveLength(2);
    expect(screen.getByText(/MARKET STORE 12/)).toBeVisible();
    expect(screen.getByText('Mined rule health')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(send).toHaveBeenCalledWith('ai/resolve-suggestion', {
      id: 'suggestion-1',
      action: 'accept',
    });

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select all rule proposals',
      }),
    );
    expect(screen.getByText('2 selected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Approve selected' }));

    expect(send).toHaveBeenCalledWith('ai/resolve-rule-proposal', {
      id: 'proposal-1',
      action: 'approve',
    });
    expect(send).toHaveBeenCalledWith('ai/resolve-rule-proposal', {
      id: 'proposal-2',
      action: 'approve',
    });
  });

  it('shows a compact pending-review notice on mobile', async () => {
    renderPage(<PendingAiReviewNotice isMobile />);

    expect(
      await screen.findByRole('button', {
        name: '1 AI categorizations pending review',
      }),
    ).toBeVisible();
  });

  it('makes the AI rationale reachable without a hover tooltip', async () => {
    const user = userEvent.setup();
    renderPage(<SuggestionsInbox />);

    const category = await screen.findByText('Groceries');
    expect(category).toBeVisible();
    expect(category.closest('[data-testid="row"]')).toHaveStyle({
      height: 'auto',
      minHeight: '58px',
    });
    expect(
      screen.queryByText('Similar purchases were categorized as groceries.'),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Why this suggestion?' }),
    );

    expect(
      screen.getByText('Similar purchases were categorized as groceries.'),
    ).toBeVisible();
  });

  it('does not report an unavailable rule-health query as an empty state', async () => {
    aiListFixture.failRuleHealth = true;
    renderPage(<RuleHealthPanel />);

    expect(
      await screen.findByText('Could not load mined rule health.'),
    ).toBeVisible();
    expect(screen.queryByText('No mined rules yet.')).not.toBeInTheDocument();
  });
});
