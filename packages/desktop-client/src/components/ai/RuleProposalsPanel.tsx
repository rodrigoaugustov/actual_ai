import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
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
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMining, setIsMining] = useState(false);
  const { data: proposals = [] } = useQuery({
    queryKey: PROPOSALS_QUERY_KEY,
    queryFn: () => send('ai/get-rule-proposals'),
  });

  const onMineNow = async () => {
    setIsMining(true);
    try {
      const result = await send('ai/mine-rules');
      await queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
      dispatch(
        addNotification({
          notification: mineRulesNotification(t, result, navigate),
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontWeight: 600 }}>
          <Trans>Rule proposals ({{ count: proposals.length }})</Trans>
        </Text>
        <ButtonWithLoading isLoading={isMining} onPress={onMineNow}>
          <Trans>Mine rules now</Trans>
        </ButtonWithLoading>
      </View>
      {proposals.length === 0 && (
        <Text style={{ color: theme.pageTextSubdued }}>
          {t(
            'No pending proposals. Mining looks at your categorized history for payees with a consistent category, and never applies a rule without your approval.',
          )}
        </Text>
      )}
      {proposals.map(proposal => (
        <ProposalRow key={proposal.id} proposal={proposal} />
      ))}
    </View>
  );
}

function ProposalRow({ proposal }: { proposal: AiRuleMetaEntity }) {
  const queryClient = useQueryClient();
  const { data } = useCategoriesById();
  const categoriesById = data?.list;
  const [isLoading, setIsLoading] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });

  const onResolve = async (action: 'approve' | 'reject') => {
    setIsLoading(true);
    try {
      await send('ai/resolve-rule-proposal', { id: proposal.id, action });
      await invalidate();
    } finally {
      setIsLoading(false);
    }
  };

  const categoryName =
    categoriesById?.[proposal.categoryId]?.name ?? proposal.categoryId;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 0',
        borderBottom: '1px solid ' + theme.pillBorderDark,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: 600 }}>
          {proposal.payeeName} — {proposal.op} "{proposal.value}" →{' '}
          {categoryName}
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
          {proposal.rationale}
        </Text>
      </View>
      <ButtonWithLoading
        isLoading={isLoading}
        variant="primary"
        onPress={() => onResolve('approve')}
      >
        <Trans>Approve</Trans>
      </ButtonWithLoading>
      <Button onPress={() => void onResolve('reject')}>
        <Trans>Reject</Trans>
      </Button>
    </View>
  );
}
