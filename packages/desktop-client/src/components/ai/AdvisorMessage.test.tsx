import type { AiMessageEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TestProviders } from '#mocks';

import { AdvisorMessage } from './AdvisorMessage';

function message(overrides: Partial<AiMessageEntity> = {}): AiMessageEntity {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    role: 'assistant',
    content: '',
    parts: [],
    runId: null,
    createdAt: 1,
    ...overrides,
  };
}

describe('AdvisorMessage', () => {
  it('renders assistant Markdown with headings, lists, tables, and safe links', () => {
    render(
      <AdvisorMessage
        message={message({
          content: [
            '## Diagnóstico',
            '',
            '**Prioridade:** formar a reserva.',
            '',
            '- Reduzir o risco',
            '- Preservar liquidez',
            '',
            '| Item | Valor |',
            '| --- | ---: |',
            '| Reserva | R$ 1.000 |',
            '',
            '[Saiba mais](https://example.com)',
            '',
            '![imagem externa](https://example.com/tracker.png)',
          ].join('\n'),
        })}
      />,
      { wrapper: TestProviders },
    );

    expect(
      screen.getByRole('heading', { name: 'Diagnóstico' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Prioridade:').tagName).toBe('STRONG');

    const link = screen.getByRole('link', { name: 'Saiba mais' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps user input as plain text', () => {
    render(
      <AdvisorMessage
        message={message({
          role: 'user',
          content: '## Isto não é um título',
        })}
      />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('## Isto não é um título')).toBeInTheDocument();
  });

  it('shows completed tools and context sources without duplicates', () => {
    render(
      <AdvisorMessage
        message={message({
          content: 'Resposta',
          parts: [
            {
              type: 'tool',
              toolName: 'get_financial_snapshot',
              state: 'result',
            },
            {
              type: 'tool',
              toolName: 'get_financial_snapshot',
              state: 'result',
            },
            {
              type: 'tool',
              toolName: 'get_advisor_profile',
              state: 'call',
            },
            {
              type: 'source',
              sourceType: 'financial',
              sourceId: 'snapshot',
              title: 'Resumo financeiro',
            },
          ],
        })}
      />,
      { wrapper: TestProviders },
    );

    const renderedMessage = screen.getByTestId('advisor-message-assistant');
    expect(renderedMessage).toHaveTextContent(
      'Reviewing balances and net worth',
    );
    expect(
      renderedMessage.textContent?.match(/Reviewing balances and net worth/g),
    ).toHaveLength(1);
    expect(renderedMessage).not.toHaveTextContent('get_advisor_profile');
    expect(renderedMessage).toHaveTextContent('Resumo financeiro');
  });

  it('keeps a persisted execution trace collapsed and expandable', async () => {
    const user = userEvent.setup();
    render(
      <AdvisorMessage
        message={message({
          content: 'Resposta fundamentada.',
          parts: [
            {
              type: 'trace',
              id: 'tool:analysis',
              kind: 'tool',
              state: 'completed',
              toolName: 'run_financial_analysis',
              startedAt: 1_000,
              completedAt: 2_500,
              detail: {
                dataset: 'transactions',
                sourceRows: 150,
                resultRows: 12,
                returnedRows: 12,
                complete: true,
              },
            },
          ],
        })}
      />,
      { wrapper: TestProviders },
    );

    const toggle = screen.getByRole('button', {
      name: /How I got there/i,
    });
    const answer = screen.getByText('Resposta fundamentada.');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      answer.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(toggle);
    expect(screen.getByText('150 source records examined')).toBeVisible();
    expect(screen.getByText('Coverage complete')).toBeVisible();
    expect(screen.getByText('Completed in 1.5s')).toBeVisible();
  });

  it('does not repeat a tool in metadata when its trace already explains it', async () => {
    const user = userEvent.setup();
    render(
      <AdvisorMessage
        message={message({
          content: 'Answer grounded in the analysis.',
          parts: [
            {
              type: 'tool',
              toolName: 'run_financial_analysis',
              state: 'result',
            },
            {
              type: 'trace',
              id: 'tool:analysis',
              kind: 'tool',
              state: 'completed',
              toolName: 'run_financial_analysis',
              startedAt: 1_000,
              completedAt: 1_100,
            },
          ],
        })}
      />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByText('Consulted tools:')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'How I got there' }));
    expect(screen.getAllByText('Running a financial analysis')).toHaveLength(1);
  });
});
