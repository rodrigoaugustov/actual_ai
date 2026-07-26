import { MemoryRouter } from 'react-router';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { MobileNavTabs } from './MobileNavTabs';

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

describe('MobileNavTabs', () => {
  it('keeps five primary destinations and places analyses under House', () => {
    render(
      <MemoryRouter>
        <MobileNavTabs />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    expect(
      within(navigation)
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual(['Today', 'Movements', 'Plan', 'Assistant']);

    const houseButton = within(navigation).getByRole('button', {
      name: 'House',
    });
    expect(houseButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(houseButton);

    expect(houseButton).toHaveAttribute('aria-expanded', 'true');
    const houseNavigation = screen.getByTestId('house-navigation');
    expect(
      within(houseNavigation).getByRole('link', { name: 'Analyses' }),
    ).toBeVisible();
    expect(
      within(houseNavigation).getByRole('link', { name: 'Settings' }),
    ).toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(houseButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('house-navigation')).not.toBeInTheDocument();
    expect(houseButton).toHaveFocus();
  });
});
