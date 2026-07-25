import { MemoryRouter } from 'react-router';

import { send } from '@actual-app/core/platform/client/connection';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient, TestProviders } from '#mocks';

import { ClassifyTransactionsWithAiButton } from './ClassifyTransactionsWithAiButton';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(async () => ({
    status: 'ok',
    autoApplied: 1,
    pendingReview: 0,
  })),
}));

const transaction = {
  id: 'transaction-1',
  account: 'account-1',
  amount: -1200,
  date: '2026-07-25',
} satisfies TransactionEntity;

describe('ClassifyTransactionsWithAiButton', () => {
  it('classifies every supplied uncategorized transaction', async () => {
    const user = userEvent.setup();
    render(
      <TestProviders queryClient={createTestQueryClient()}>
        <MemoryRouter>
          <ClassifyTransactionsWithAiButton
            transactions={[transaction]}
            style={{ width: '100%', minHeight: 40 }}
          />
        </MemoryRouter>
      </TestProviders>,
    );

    const button = screen.getByRole('button', {
      name: 'Classify all with AI',
    });
    expect(button).toHaveStyle({ width: '100%', minHeight: '40px' });

    await user.click(button);

    expect(send).toHaveBeenCalledWith('ai/classify-now', {
      transactionIds: ['transaction-1'],
    });
  });
});
