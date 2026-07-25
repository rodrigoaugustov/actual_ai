import { useRef } from 'react';
import { MemoryRouter } from 'react-router';

import { fireEvent, render, screen } from '@testing-library/react';

import { ScrollProvider } from '#hooks/useScrollListener';

import { MobileNavTabs } from './MobileNavTabs';

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

function TestNav() {
  const scrollableRef = useRef<HTMLDivElement>(null);

  return (
    <ScrollProvider scrollableRef={scrollableRef} isDisabled>
      <div ref={scrollableRef}>
        <MobileNavTabs />
      </div>
    </ScrollProvider>
  );
}

describe('MobileNavTabs', () => {
  it('keeps AI operations, the advisor, and settings reachable', () => {
    render(
      <MemoryRouter>
        <TestNav />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation');
    const links = [...navigation.querySelectorAll('a')];
    expect(links.slice(-3).map(link => link.textContent)).toEqual([
      'AI operations',
      'Financial advisor',
      'Settings',
    ]);
    expect(navigation).toHaveStyle({ height: '308px' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Expand navigation menu' }),
    );
    expect(navigation).toHaveAttribute('data-navbar-state', 'open');
    expect(screen.getByRole('link', { name: 'Settings' })).toBeVisible();
  });
});
