import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import type { CSSProperties } from '@actual-app/components/styles';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  ClassifyOutcome,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { useQueryClient } from '@tanstack/react-query';

import { useNavigate } from '#hooks/useNavigate';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

function classifyNowNotification(
  t: (key: string, options?: Record<string, unknown>) => string,
  outcome: ClassifyOutcome,
  navigate: (path: string) => void,
) {
  switch (outcome.status) {
    case 'disabled':
      return {
        type: 'warning' as const,
        message: t('AI features are disabled — enable them in Settings first.'),
      };
    case 'budget-exceeded':
      return {
        type: 'warning' as const,
        message: t("Skipped: today's AI spend limit has already been reached."),
      };
    case 'no-pending':
      return {
        type: 'message' as const,
        message: t(
          'Nothing to classify — all selected transactions are already categorized.',
        ),
      };
    case 'run-failed':
      return {
        type: 'error' as const,
        message: t(
          'AI classification failed. Check the AI usage log for details.',
        ),
        button: {
          title: t('View AI usage log'),
          action: () => navigate('/ai-usage'),
        },
      };
    case 'ok':
      return {
        type: 'message' as const,
        message:
          outcome.autoApplied + outcome.pendingReview > 0
            ? t(
                '{{autoApplied}} categorized, {{pendingReview}} awaiting review.',
                {
                  autoApplied: outcome.autoApplied,
                  pendingReview: outcome.pendingReview,
                },
              )
            : t('AI had no confident suggestions for these transactions.'),
      };
    default: {
      const exhaustive: never = outcome;
      throw new Error(
        `Unknown classify outcome: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

type ClassifyTransactionsWithAiButtonProps = {
  transactions: readonly TransactionEntity[];
  selectedIds?: readonly string[];
  style?: CSSProperties;
};

export function ClassifyTransactionsWithAiButton({
  transactions,
  selectedIds = [],
  style,
}: ClassifyTransactionsWithAiButtonProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isClassifying, setIsClassifying] = useState(false);
  const idsToClassify =
    selectedIds.length > 0
      ? [...selectedIds]
      : transactions.map(transaction => transaction.id);

  if (idsToClassify.length === 0) {
    return null;
  }

  const onClassify = async () => {
    if (isClassifying) {
      return;
    }

    setIsClassifying(true);
    try {
      const outcome = await send('ai/classify-now', {
        transactionIds: idsToClassify,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ai-suggestions-index'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] }),
      ]);
      dispatch(
        addNotification({
          notification: classifyNowNotification(t, outcome, navigate),
        }),
      );
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'AI classification failed. Check the AI usage log for details.',
            ),
            button: {
              title: t('View AI usage log'),
              action: () => navigate('/ai-usage'),
            },
          },
        }),
      );
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <ButtonWithLoading
      style={style}
      isLoading={isClassifying}
      onPress={onClassify}
    >
      {selectedIds.length > 0
        ? t('Classify {{count}} selected with AI', {
            count: selectedIds.length,
          })
        : t('Classify all with AI')}
    </ButtonWithLoading>
  );
}
