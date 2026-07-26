import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  getInitialOrganizationSection,
  OrganizationMap,
} from './OrganizationMap';
import type { OrganizationSectionId } from './OrganizationMap';

describe('OrganizationMap', () => {
  it('keeps budget switching secondary and opens the selected chapter', async () => {
    const user = userEvent.setup();
    const onSelectSection = vi.fn<(section: OrganizationSectionId) => void>();
    const onSwitchBudget = vi.fn();

    render(
      <OrganizationMap
        activeSection="house"
        budgetName="Family budget"
        isSyncConfigured={false}
        onSelectSection={onSelectSection}
        onSwitchBudget={onSwitchBudget}
      />,
    );

    expect(screen.getByText('Family budget')).toBeInTheDocument();
    expect(screen.getByText('Local budget')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: /Appearance and formats/,
      }),
    );
    expect(onSelectSection).toHaveBeenCalledWith('appearance');

    await user.click(screen.getByRole('button', { name: 'Switch budget' }));
    expect(onSwitchBudget).toHaveBeenCalledOnce();
  });

  it('describes sync only when it is configured', () => {
    render(
      <OrganizationMap
        activeSection={null}
        budgetName="Family budget"
        isSyncConfigured
        onSelectSection={vi.fn()}
        onSwitchBudget={vi.fn()}
      />,
    );

    expect(screen.getByText('Sync is configured')).toBeInTheDocument();
  });

  it('restores focus to a chapter when returning to the map', () => {
    const onFocusRestored = vi.fn();

    render(
      <OrganizationMap
        activeSection={null}
        budgetName="Family budget"
        isSyncConfigured={false}
        focusSection="assistant"
        onFocusRestored={onFocusRestored}
        onSelectSection={vi.fn()}
        onSwitchBudget={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: /Assistant/,
      }),
    ).toHaveFocus();
    expect(onFocusRestored).toHaveBeenCalledOnce();
  });
});

describe('getInitialOrganizationSection', () => {
  it('opens data and maintenance for the advanced deep link', () => {
    expect(getInitialOrganizationSection('#advanced')).toBe('data');
    expect(getInitialOrganizationSection('')).toBeNull();
  });
});
