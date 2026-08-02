import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestProviders } from '#mocks';

import { CapacityRailView } from './CapacityRail';

const values = {
  committed: 60,
  planned: 30,
  available: 10,
};

describe('Home CapacityRail accessibility', () => {
  it('announces committed when transfer separation is off', () => {
    render(
      <TestProviders>
        <CapacityRailView values={values} committedLabel="Committed" />
      </TestProviders>,
    );

    expect(
      screen.getByLabelText(
        'Month capacity: 0.60 committed, 0.30 planned, 0.10 available',
      ),
    ).toBeInTheDocument();
  });

  it('announces spent when transfer separation is on', () => {
    render(
      <TestProviders>
        <CapacityRailView values={values} committedLabel="Spent" />
      </TestProviders>,
    );

    expect(
      screen.getByLabelText(
        'Month capacity: 0.60 spent, 0.30 planned, 0.10 available',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/committed/)).not.toBeInTheDocument();
  });
});
