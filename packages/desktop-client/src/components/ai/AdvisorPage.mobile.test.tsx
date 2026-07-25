import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient, TestProviders } from '#mocks';

import { MobileAdvisorPage } from './AdvisorPage';

vi.mock('#hooks/useNavigate', () => ({
  useNavigate: () => vi.fn(),
}));

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
  function renderPage() {
    return render(
      <TestProviders queryClient={createTestQueryClient()}>
        <MobileAdvisorPage />
      </TestProviders>,
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

    await user.click(screen.getByRole('button', { name: 'Profile & memory' }));

    expect(screen.getByText('Pending confirmations')).toBeVisible();
    expect(screen.getByText('Add a profile fact')).toBeVisible();
  });
});
