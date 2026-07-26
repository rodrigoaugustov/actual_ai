import React from 'react';

import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { SummaryNumber } from './SummaryNumber';

describe('SummaryNumber accessibility', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { value: 12345, label: 'Positive amount: 123.45' },
    { value: -12345, label: 'Negative amount: 123.45' },
    { value: 0, label: 'Zero amount' },
    { value: Number.NaN, label: 'Unknown amount' },
  ])('announces $label from semantic output', ({ value, label }) => {
    render(
      <TestProviders>
        <SummaryNumber
          value={value}
          contentType="sum"
          loading={false}
          compact
        />
      </TestProviders>,
    );

    const output = screen.getByRole('status');
    expect(output.tagName).toBe('OUTPUT');
    expect(output).toHaveTextContent(label);
  });
});
