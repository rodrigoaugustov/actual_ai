import type { AiTracePart } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestProviders } from '#mocks';

import { AdvisorTrace } from './AdvisorTrace';

const trace: AiTracePart[] = [
  {
    type: 'trace',
    id: 'context',
    kind: 'context',
    state: 'completed',
    startedAt: 1_000,
    completedAt: 1_200,
    detail: { memoryCount: 2, goalCount: 1, sourceCount: 3 },
  },
  {
    type: 'trace',
    id: 'tool:analysis',
    kind: 'tool',
    state: 'running',
    toolName: 'run_financial_analysis',
    startedAt: 1_300,
    detail: {
      dataset: 'transactions',
      dimensions: ['year_month'],
      metrics: ['income (sum)', 'expenses (sum)'],
    },
  },
];

describe('AdvisorTrace', () => {
  it('stays expanded while running and shows safe execution details', () => {
    render(<AdvisorTrace trace={trace} isRunning />, {
      wrapper: TestProviders,
    });

    expect(
      screen.getByRole('button', { name: /Working through your request/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Running a financial analysis')).toBeVisible();
    expect(screen.getByText('Dataset: transactions')).toBeVisible();
    expect(screen.getByText(/income \(sum\)/)).toBeVisible();
  });

  it('collapses automatically when the run finishes and can be reopened', async () => {
    const user = userEvent.setup();
    const rendered = render(<AdvisorTrace trace={trace} isRunning />, {
      wrapper: TestProviders,
    });

    rendered.rerender(<AdvisorTrace trace={trace} isRunning={false} />);
    const toggle = screen.getByRole('button', {
      name: /How I got there/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByLabelText('Analysis execution details'),
    ).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Analysis execution details')).toBeVisible();
  });
});
