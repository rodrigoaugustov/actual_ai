import { MemoryRouter, useLocation } from 'react-router';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useNavigate } from '#hooks/useNavigate';
import { createTestQueryClient, TestProviders } from '#mocks';

import { MobileAdvisorPage } from './AdvisorPage';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  listen: vi.fn(() => vi.fn()),
  send: vi.fn(async (method: string) => {
    switch (method) {
      case 'ai/advisor/list-conversations':
        return [
          {
            id: 'conversation-1',
            title: 'Household plan',
            createdAt: 1,
            updatedAt: 1,
          },
        ];
      case 'ai/advisor/list-messages':
      case 'ai/advisor/list-memory':
        return [];
      case 'ai/advisor/list-goals':
        return [
          {
            id: 'goal-1',
            title: 'Emergency fund',
            description: 'Reach six months of expenses.',
            targetAmount: null,
            targetDate: null,
            priority: 1,
            flexibility: 'flexible',
            status: 'active',
            progressNote: null,
            nextReviewAt: new Date(2026, 6, 30, 12).getTime(),
            createdAt: 1,
            updatedAt: 1,
          },
        ];
      case 'ai/advisor/list-documents':
        return [
          {
            id: 'document-1',
            title: 'Benefit policy',
            kind: 'user-note',
            content: `${'Policy context. '.repeat(24)}FULL DOCUMENT END`,
            source: 'user',
            createdAt: 1,
            updatedAt: 1,
          },
        ];
      case 'ai/advisor/list-advice':
        return [
          {
            id: 'advice-1',
            conversationId: 'conversation-1',
            title: 'Build the reserve',
            recommendation: 'Transfer a fixed amount after each payday.',
            assumptions: ['Income remains stable.'],
            evidence: [
              {
                type: 'source',
                sourceType: 'financial',
                sourceId: 'cash-flow',
                title: 'Cash flow',
                excerpt: 'Average monthly surplus is positive.',
              },
            ],
            alternatives: ['Use a smaller initial transfer.'],
            risks: ['Unexpected expenses may delay the target.'],
            status: 'proposed',
            followUpAt: new Date(2026, 7, 15, 12).getTime(),
            createdAt: 1,
            updatedAt: 1,
          },
        ];
      default:
        throw new Error(`Unexpected advisor method: ${method}`);
    }
  }),
}));

describe('MobileAdvisorPage', () => {
  function RouterProbe() {
    const location = useLocation();
    const navigate = useNavigate();

    return (
      <>
        <output data-testid="advisor-location">
          {location.pathname}
          {location.search}
        </output>
        <button type="button" onClick={() => navigate(-1)}>
          History back
        </button>
      </>
    );
  }

  function renderPage(initialEntry = '/advisor') {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <TestProviders queryClient={createTestQueryClient()}>
          <MobileAdvisorPage />
          <RouterProbe />
        </TestProviders>
      </MemoryRouter>,
    );
  }

  it('renders a full-width conversation with a mobile composer', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Financial advisor' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Household plan' }),
    ).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Advisor message' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('opens the conversation list behind the conversation field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Household plan' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Conversations' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'New' })).toBeVisible();
  });

  it('keeps profile actions reachable through the mobile section navigation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Profile & memory' }));

    expect(screen.getByText('Pending confirmations')).toBeVisible();
    expect(screen.getByText('Add a profile fact')).toBeVisible();
  });

  it('opens a deep-linked section with semantic tabs', async () => {
    renderPage('/advisor?section=goals&conversation=conversation-1');

    expect(screen.getByRole('tab', { name: 'Goals' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Goals' })).toBeVisible();
    expect(screen.getByText('New goal')).toBeVisible();
  });

  it('writes section changes to history and restores them on back', async () => {
    const user = userEvent.setup();
    renderPage('/advisor?conversation=conversation-1');

    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByTestId('advisor-location')).toHaveTextContent(
      'section=goals',
    );

    await user.click(screen.getByRole('button', { name: 'History back' }));

    expect(
      await screen.findByRole('tab', { name: 'Conversation' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('textbox', { name: 'Advisor message' }),
    ).toBeVisible();
  });

  it('shows persisted review context and expands long documents', async () => {
    const user = userEvent.setup();
    renderPage('/advisor?conversation=conversation-1&section=goals');

    expect(await screen.findByText(/Next review:/)).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByText(/…$/)).toBeVisible();
    expect(screen.queryByText(/FULL DOCUMENT END$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View more' }));
    expect(screen.getByText(/FULL DOCUMENT END$/)).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Plan' }));
    expect(screen.getByText(/Follow-up:/)).toBeVisible();
    expect(screen.getByText('Assumptions')).toBeVisible();
    expect(screen.getByText('Income remains stable.')).toBeVisible();
    expect(screen.getByText('Alternatives')).toBeVisible();
    expect(screen.getByText('Use a smaller initial transfer.')).toBeVisible();
    expect(screen.getByText('Risks')).toBeVisible();
    expect(
      screen.getByText('Unexpected expenses may delay the target.'),
    ).toBeVisible();
    expect(screen.getByText('Evidence')).toBeVisible();
    expect(
      screen.getByText(/Average monthly surplus is positive/),
    ).toBeVisible();
  });
});
