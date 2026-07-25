import type { ReactNode } from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient, TestProviders } from '#mocks';

import { MobileAiUsagePage } from './AiUsagePage';
import { MobilePendingCategorizationsPage } from './PendingCategorizationsPage';

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
      case 'ai/resolve-suggestion':
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
        {page}
      </TestProviders>,
    );
  }

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
    expect(
      screen.getByText('Similar purchases were categorized as groceries.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(send).toHaveBeenCalledWith('ai/resolve-suggestion', {
      id: 'suggestion-1',
      action: 'accept',
    });
  });
});
