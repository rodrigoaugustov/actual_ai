import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AiRuleMetaEntity,
  MineRulesOutcome,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { FinancialText } from '#components/FinancialText';
import { useCategoriesById } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
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
const HEALTH_QUERY_KEY = ['ai-rule-health'];
const EMPTY_PROPOSALS: AiRuleMetaEntity[] = [];

export function RuleProposalsPanel() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMining, setIsMining] = useState(false);
  const batchPendingRef = useRef(false);
  const [isResolvingBatch, setIsResolvingBatch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const {
    data: proposals = EMPTY_PROPOSALS,
    isError,
    isLoading,
  } = useQuery({
    queryKey: PROPOSALS_QUERY_KEY,
    queryFn: () => send('ai/get-rule-proposals'),
  });

  useEffect(() => {
    const availableIds = new Set(proposals.map(proposal => proposal.id));
    setSelectedIds(current => {
      const availableSelected = current.filter(id => availableIds.has(id));
      return availableSelected.length === current.length
        ? current
        : availableSelected;
    });
  }, [proposals]);

  const toggleSelected = (id: string) => {
    setSelectedIds(current =>
      current.includes(id)
        ? current.filter(selectedId => selectedId !== id)
        : [...current, id],
    );
  };

  const toggleAll = () => {
    setSelectedIds(
      selectedIds.length === proposals.length
        ? []
        : proposals.map(proposal => proposal.id),
    );
  };

  const onResolveBatch = async (action: 'approve' | 'reject') => {
    if (batchPendingRef.current || selectedIds.length === 0) {
      return;
    }

    batchPendingRef.current = true;
    setIsResolvingBatch(true);
    const ids = [...selectedIds];
    try {
      const results = await Promise.allSettled(
        ids.map(id => send('ai/resolve-rule-proposal', { id, action })),
      );
      const failedIds = ids.filter(
        (_, index) => results[index]?.status === 'rejected',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY }),
        action === 'approve'
          ? queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
          : Promise.resolve(),
      ]);
      setSelectedIds(failedIds);
      if (failedIds.length > 0) {
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              message: t(
                '{{resolved}} proposal(s) resolved, but {{failed}} failed. The failed proposals remain selected so you can retry.',
                {
                  resolved: ids.length - failedIds.length,
                  failed: failedIds.length,
                },
              ),
            },
          }),
        );
      } else {
        dispatch(
          addNotification({
            notification: {
              type: 'message',
              message:
                action === 'approve'
                  ? t('{{count}} rule proposal(s) approved.', {
                      count: ids.length,
                    })
                  : t('{{count}} rule proposal(s) rejected.', {
                      count: ids.length,
                    }),
            },
          }),
        );
      }
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not resolve the selected rule proposals. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      batchPendingRef.current = false;
      setIsResolvingBatch(false);
    }
  };

  const onMineNow = async () => {
    if (isMining || isResolvingBatch) {
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
          isDisabled={isMining || isResolvingBatch}
          isLoading={isMining}
          onPress={onMineNow}
        >
          <Trans>Mine rules now</Trans>
        </ButtonWithLoading>
      </View>
      {!isLoading && !isError && proposals.length > 0 && (
        <View
          style={{
            flexDirection: isNarrowWidth ? 'column' : 'row',
            alignItems: isNarrowWidth ? 'stretch' : 'center',
            gap: 8,
            padding: '6px 0',
          }}
        >
          <label
            style={{
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginRight: 'auto',
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.length === proposals.length}
              disabled={isResolvingBatch}
              aria-label={t('Select all rule proposals')}
              onChange={toggleAll}
            />
            {t('{{count}} selected', { count: selectedIds.length })}
          </label>
          <ButtonWithLoading
            style={isNarrowWidth ? { minHeight: 40 } : undefined}
            variant="primary"
            isDisabled={isResolvingBatch || selectedIds.length === 0}
            isLoading={isResolvingBatch}
            onPress={() => onResolveBatch('approve')}
          >
            <Trans>Approve selected</Trans>
          </ButtonWithLoading>
          <Button
            style={isNarrowWidth ? { minHeight: 40 } : undefined}
            isDisabled={isResolvingBatch || selectedIds.length === 0}
            onPress={() => void onResolveBatch('reject')}
          >
            <Trans>Reject selected</Trans>
          </Button>
        </View>
      )}
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
          <ProposalRow
            key={proposal.id}
            proposal={proposal}
            isSelected={selectedIds.includes(proposal.id)}
            isBatchPending={isResolvingBatch}
            onToggle={() => toggleSelected(proposal.id)}
          />
        ))
      )}
    </View>
  );
}

function ProposalRow({
  proposal,
  isSelected,
  isBatchPending,
  onToggle,
}: {
  proposal: AiRuleMetaEntity;
  isSelected: boolean;
  isBatchPending: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const format = useFormat();
  const { data } = useCategoriesById();
  const categoriesById = data?.list;
  const pendingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  const invalidate = (action: 'approve' | 'reject') =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY }),
      action === 'approve'
        ? queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
        : Promise.resolve(),
    ]);

  const onResolve = async (action: 'approve' | 'reject') => {
    if (pendingRef.current || isBatchPending) {
      return;
    }

    pendingRef.current = true;
    setIsLoading(true);
    try {
      await send('ai/resolve-rule-proposal', { id: proposal.id, action });
      await invalidate(action);
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
      pendingRef.current = false;
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
        <label
          style={{
            minHeight: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isBatchPending}
            aria-label={t('Select rule proposal for {{payee}}', {
              payee: proposal.payeeName,
            })}
            onChange={onToggle}
          />
          <Text style={{ fontWeight: 600 }}>
            {proposal.payeeName} — {ruleOperatorLabel(proposal.op, t)} "
            {proposal.value}" → {categoryName}
          </Text>
        </label>
        <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
          {proposal.rationale}
        </Text>
        <View style={{ gap: 4, marginTop: 6 }}>
          <Text style={{ fontSize: '0.85em', fontWeight: 600 }}>
            <Trans>Sample transactions</Trans>
          </Text>
          {proposal.sampleTransactions?.length ? (
            proposal.sampleTransactions.map(sample => (
              <View
                key={sample.id}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '2px 10px',
                  padding: '3px 0',
                }}
              >
                <Text style={{ minWidth: 0 }}>
                  {monthUtils.format(sample.date, dateFormat)} ·{' '}
                  {sample.importedPayee || sample.payeeName || t('(no payee)')}
                  {sample.accountName ? ` · ${sample.accountName}` : ''}
                </Text>
                <FinancialText>
                  {format(sample.amount, 'financial')}
                </FinancialText>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}>
              <Trans>No sample transactions are still available.</Trans>
            </Text>
          )}
        </View>
      </View>
      <ButtonWithLoading
        style={isNarrowWidth ? { minHeight: 40 } : undefined}
        isDisabled={isLoading || isBatchPending}
        isLoading={isLoading}
        variant="primary"
        onPress={() => onResolve('approve')}
      >
        <Trans>Approve</Trans>
      </ButtonWithLoading>
      <Button
        style={isNarrowWidth ? { minHeight: 40 } : undefined}
        isDisabled={isLoading || isBatchPending}
        onPress={() => void onResolve('reject')}
      >
        <Trans>Reject</Trans>
      </Button>
    </View>
  );
}
