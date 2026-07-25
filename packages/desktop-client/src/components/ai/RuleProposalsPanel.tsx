import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  AiRuleMetaEntity,
  MineRulesOutcome,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCategoriesById } from '#hooks/useCategories';
import { useNavigate } from '#hooks/useNavigate';
import type { Notification } from '#notifications/notificationsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { ruleOperatorLabel } from './labels';

function mineRulesNotification(
  t: (key: string, options?: Record<string, unknown>) => string,
  result: MineRulesOutcome,
  navigate: (path: string) => void,
): Notification {
  switch (result.status) {
    case 'disabled':
      return {
        type: 'warning',
        message: t('AI features are disabled — enable them above first.'),
      };
    case 'budget-exceeded':
      return {
        type: 'warning',
        message: t("Skipped: today's AI spend limit has already been reached."),
      };
    case 'no-candidates':
      return {
        type: 'message',
        message: t(
          'No new rules found — mining needs at least 3 categorized transactions for the same payee.',
        ),
      };
    case 'run-failed':
      return {
        type: 'error',
        message: t('Rule mining failed. Check the AI usage log for details.'),
        button: {
          title: t('View AI usage log'),
          action: () => navigate('/ai-usage'),
        },
      };
    case 'ok':
      return {
        type: 'message',
        message:
          result.proposalsCreated > 0
            ? t('Found {{count}} new rule proposal(s) to review.', {
                count: result.proposalsCreated,
              })
            : t('No new rules found in this pass.'),
      };
    default: {
      const exhaustive: never = result;
      throw new Error(
        `Unknown mine-rules outcome: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

const PROPOSALS_QUERY_KEY = ['ai-rule-proposals'];

export function RuleProposalsPanel() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMining, setIsMining] = useState(false);
  const {
    data: proposals = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: PROPOSALS_QUERY_KEY,
    queryFn: () => send('ai/get-rule-proposals'),
  });

  const onMineNow = async () => {
    if (isMining) {
      return;
    }

    setIsMining(true);
    try {
      const result = await send('ai/mine-rules');
      await queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
      dispatch(
        addNotification({
          notification: mineRulesNotification(t, result, navigate),
        }),
      );
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Rule mining failed. Check the AI usage log for details.',
            ),
            button: {
              title: t('View AI usage log'),
              action: () => navigate('/ai-usage'),
            },
          },
        }),
      );
    } finally {
      setIsMining(false);
    }
  };

  return (
    <View style={{ width: '100%', gap: 8 }}>
      <View
        style={{
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text style={{ fontWeight: 600 }}>
          {!isLoading && !isError ? (
            <Trans>Rule proposals ({{ count: proposals.length }})</Trans>
          ) : (
            <Trans>Rule proposals</Trans>
          )}
        </Text>
        <ButtonWithLoading
          isDisabled={isMining}
          isLoading={isMining}
          onPress={onMineNow}
        >
          <Trans>Mine rules now</Trans>
        </ButtonWithLoading>
      </View>
      {isLoading ? (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <AnimatedLoading width={20} color={theme.pageTextSubdued} />
        </View>
      ) : isError ? (
        <Text style={{ color: theme.errorText }}>
          <Trans>Could not load rule proposals.</Trans>
        </Text>
      ) : proposals.length === 0 ? (
        <Text style={{ color: theme.pageTextSubdued }}>
          {t(
            'No pending proposals. Mining looks at your categorized history for payees with a consistent category, and never applies a rule without your approval.',
          )}
        </Text>
      ) : (
        proposals.map(proposal => (
          <ProposalRow key={proposal.id} proposal={proposal} />
        ))
      )}
    </View>
  );
}

function ProposalRow({ proposal }: { proposal: AiRuleMetaEntity }) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { data } = useCategoriesById();
  const categoriesById = data?.list;
  const [isLoading, setIsLoading] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });

  const onResolve = async (action: 'approve' | 'reject') => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      await send('ai/resolve-rule-proposal', { id: proposal.id, action });
      await invalidate();
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not resolve this rule proposal. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const categoryName =
    categoriesById?.[proposal.categoryId]?.name ?? proposal.categoryId;

  return (
    <View
      style={{
        flexDirection: isNarrowWidth ? 'column' : 'row',
        alignItems: isNarrowWidth ? 'stretch' : 'center',
        gap: 8,
        width: '100%',
        padding: '6px 0',
        borderBottom: '1px solid ' + theme.pillBorderDark,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: 600 }}>
          {proposal.payeeName} — {ruleOperatorLabel(proposal.op, t)} "
          {proposal.value}" → {categoryName}
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
          {proposal.rationale}
        </Text>
      </View>
      <ButtonWithLoading
        style={isNarrowWidth ? { minHeight: 40 } : undefined}
        isDisabled={isLoading}
        isLoading={isLoading}
        variant="primary"
        onPress={() => onResolve('approve')}
      >
        <Trans>Approve</Trans>
      </ButtonWithLoading>
      <Button
        style={isNarrowWidth ? { minHeight: 40 } : undefined}
        isDisabled={isLoading}
        onPress={() => void onResolve('reject')}
      >
        <Trans>Reject</Trans>
      </Button>
    </View>
  );
}
