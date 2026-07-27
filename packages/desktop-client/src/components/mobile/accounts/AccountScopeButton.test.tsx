import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { AccountScopeButton } from './AccountScopeButton';

const { dispatchMock, navigateMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('#hooks/useAccounts', () => ({
  useAccounts: () => ({
    data: [
      { id: 'checking', name: 'Joint checking', closed: 0 },
      { id: 'archive', name: 'Old card', closed: 1 },
    ],
  }),
}));

vi.mock('#hooks/useNavigate', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('#redux', () => ({
  useDispatch: () => dispatchMock,
}));

describe('AccountScopeButton', () => {
  beforeEach(() => {
    dispatchMock.mockReset();
    navigateMock.mockReset();
  });

  it('switches account scope and restores focus when dismissed', () => {
    render(
      <AccountScopeButton currentId={undefined} currentName="All Accounts" />,
    );

    const trigger = screen.getByRole('button', { name: 'All Accounts' });
    fireEvent.click(trigger);

    const selector = screen.getByRole('dialog', {
      name: 'Choose account',
    });
    expect(
      within(selector).getByRole('button', { name: 'Close' }),
    ).toHaveFocus();
    expect(
      within(selector).getByRole('button', { name: 'Joint checking' }),
    ).toBeVisible();
    expect(
      within(selector).getByRole('button', { name: 'Old card' }),
    ).toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Choose account' }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Choose account' })).getByRole(
        'button',
        { name: 'Joint checking' },
      ),
    );

    expect(navigateMock).toHaveBeenCalledWith('/accounts/checking');

    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Choose account' })).getByRole(
        'button',
        { name: 'Add account' },
      ),
    );

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'modals/pushModal' }),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Choose account' }),
    ).not.toBeInTheDocument();
  });

  it('marks a real account as current and restores focus from the backdrop', async () => {
    render(
      <AccountScopeButton currentId="checking" currentName="Joint checking" />,
    );

    const trigger = screen.getByRole('button', { name: 'Joint checking' });
    fireEvent.click(trigger);

    const selector = screen.getByRole('dialog', { name: 'Choose account' });
    expect(
      within(selector).getByRole('button', { name: 'Joint checking' }),
    ).toHaveAttribute('aria-current', 'page');

    fireEvent.click(
      screen.getByRole('button', { name: 'Close account selector' }),
    );
    expect(selector).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
