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
      case 'ai/advisor/list-goals':
      case 'ai/advisor/list-documents':
      case 'ai/advisor/list-advice':
        return [];
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
});
