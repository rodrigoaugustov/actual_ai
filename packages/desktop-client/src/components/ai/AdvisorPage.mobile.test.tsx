import { MemoryRouter, useLocation } from 'react-router';

import { listen } from '@actual-app/core/platform/client/connection';
import type { AiAdvisorEvent } from '@actual-app/core/types/server-events';
import { act, render, screen, waitFor } from '@testing-library/react';
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
          {
            id: 'conversation-2',
            title: 'Second plan',
            createdAt: 2,
            updatedAt: 2,
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
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  function emitAdvisorEvent(event: AiAdvisorEvent) {
    const listenerCall = vi.mocked(listen).mock.calls.at(-1);
    if (!listenerCall) {
      throw new Error('Advisor listener was not registered.');
    }

    act(() => listenerCall[1](event));
  }

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
      await screen.findByRole('heading', { name: 'Household plan' }),
    ).toBeVisible();
    expect(
      await screen.findByText('What should we look at together?'),
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
      await screen.findByRole('button', { name: 'Conversation history' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Conversations' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'New conversation' }),
    ).toBeVisible();
  });

  it('preserves the draft and blocks sending while offline', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Can we take on a new commitment?',
      }),
    );
    const textbox = screen.getByRole('textbox', { name: 'Advisor message' });
    await waitFor(() =>
      expect(textbox).toHaveValue('Can we take on a new commitment?'),
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    act(() => window.dispatchEvent(new Event('offline')));

    expect(textbox).toHaveValue('Can we take on a new commitment?');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(
      screen.getByText('The Assistant needs a connection to respond.'),
    ).toBeVisible();

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('restores a conversation draft after the page remounts', async () => {
    const user = userEvent.setup();
    const page = renderPage('/advisor?conversation=conversation-1');
    const textbox = await screen.findByRole('textbox', {
      name: 'Advisor message',
    });

    await user.type(textbox, 'Compare our next three months');
    expect(textbox).toHaveValue('Compare our next three months');

    page.unmount();
    renderPage('/advisor?conversation=conversation-1');

    expect(
      await screen.findByRole('textbox', { name: 'Advisor message' }),
    ).toHaveValue('Compare our next three months');
  });

  it('blocks conversation switching while a response is active', async () => {
    const user = userEvent.setup();
    renderPage('/advisor?conversation=conversation-1');
    await screen.findByRole('heading', { name: 'Household plan' });

    emitAdvisorEvent({
      type: 'started',
      conversationId: 'conversation-1',
      runId: 'run-1',
    });
    await user.click(
      screen.getByRole('button', { name: 'Conversation history' }),
    );

    expect(
      screen.getByRole('button', { name: 'New conversation' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Second planOpen conversation/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete "Household plan"' }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        'Finish or stop the current response before changing conversations.',
      ),
    ).toBeVisible();
  });

  it('keeps profile actions reachable through the mobile section navigation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Assistant context' }),
    );

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

    await user.click(
      await screen.findByRole('button', { name: 'Assistant context' }),
    );
    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByTestId('advisor-location')).toHaveTextContent(
      'section=goals',
    );

    await user.click(screen.getByRole('button', { name: 'History back' }));

    expect(
      screen.queryByRole('dialog', { name: 'Assistant context' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Advisor message' }),
    ).toBeVisible();
  });

  it('shows persisted review context and expands long documents', async () => {
    const user = userEvent.setup();
    renderPage('/advisor?conversation=conversation-1&section=goals');

    expect(await screen.findByText(/Next review:/)).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByText(/^Policy context.*…$/)).toBeVisible();
    expect(screen.queryByText(/FULL DOCUMENT END$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View more' }));
    expect(screen.getByText(/FULL DOCUMENT END$/)).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Plans' }));
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
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(document.querySelector('#advisor-panel-plan li')).toBeNull();
    expect(screen.getByRole('button', { name: 'Accept plan' })).toHaveStyle({
      width: '100%',
      minHeight: '40px',
    });
  });
});
