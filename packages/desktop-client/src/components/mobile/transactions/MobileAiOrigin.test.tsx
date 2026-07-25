import { View } from '@actual-app/components/view';
import type { AiSuggestionIndexEntry } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AiOriginBadge } from '#components/ai/AiOriginBadge';

import { MobileAiSuggestionActions } from './TransactionListItem';

const suggestion = {
  id: 'suggestion-1',
  transactionId: 'transaction-1',
  categoryId: 'category-1',
  status: 'pending',
} satisfies AiSuggestionIndexEntry;

describe('mobile AI origin and review controls', () => {
  it('distinguishes automatic, approved and pending AI origins', () => {
    render(
      <>
        <AiOriginBadge status="auto_applied" />
        <AiOriginBadge status="accepted" />
        <AiOriginBadge status="pending" />
      </>,
    );

    expect(screen.getByText('AI auto-applied')).toBeVisible();
    expect(screen.getByText('AI suggestion approved')).toBeVisible();
    expect(screen.getByText('AI suggestion pending')).toBeVisible();
  });

  it('exposes accept and reject actions for a pending suggestion', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(
      <View style={{ height: 60, flexDirection: 'row' }}>
        <MobileAiSuggestionActions
          suggestion={suggestion}
          isLoading={false}
          onResolve={onResolve}
        />
      </View>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Accept AI suggestion' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Reject AI suggestion' }),
    );

    expect(onResolve).toHaveBeenNthCalledWith(1, suggestion, 'accept');
    expect(onResolve).toHaveBeenNthCalledWith(2, suggestion, 'reject');
  });
});
