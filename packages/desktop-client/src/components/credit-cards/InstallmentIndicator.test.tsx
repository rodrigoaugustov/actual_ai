import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import {
  installmentDisplayNotes,
  InstallmentIndicator,
} from './InstallmentIndicator';

describe('InstallmentIndicator', () => {
  it('shows the installment position independently of transaction notes', () => {
    render(<InstallmentIndicator current={3} total={12} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByText('3/12')).toHaveAccessibleName(
      'Installment 3 of 12',
    );
  });

  it('hides only the legacy suffix backed by structured installment fields', () => {
    expect(installmentDisplayNotes('(3/12)', 3, 12)).toBe('');
    expect(installmentDisplayNotes('Laptop (3/12)', 3, 12)).toBe('Laptop');
    expect(installmentDisplayNotes('Laptop (2/12)', 3, 12)).toBe(
      'Laptop (2/12)',
    );
  });
});
