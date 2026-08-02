import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { OptionsButton } from './Sankey';

describe('Sankey vocabulary', () => {
  it('names the account grouping option after the Activity view', async () => {
    render(
      <TestProviders>
        <OptionsButton
          showPercentages={false}
          onTogglePercentages={vi.fn()}
          groupAccounts={false}
          onToggleGroupAccounts={vi.fn()}
        />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Options' }));

    expect(
      await screen.findByText('Group accounts in Activity view'),
    ).toBeVisible();
    expect(
      screen.queryByText('Group accounts in Spent view'),
    ).not.toBeInTheDocument();
  });
});
