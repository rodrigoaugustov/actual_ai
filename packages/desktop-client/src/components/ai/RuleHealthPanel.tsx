import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  AiRuleMetaEntity,
  AuditRulesOutcome,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCategoriesById } from '#hooks/useCategories';
import { useNavigate } from '#hooks/useNavigate';
import type { Notification } from '#notifications/notificationsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

const HEALTH_QUERY_KEY = ['ai-rule-health'];
const REVIEW_CANDIDATE_MIN_HITS = 5;
const REVIEW_CANDIDATE_MAX_PRECISION = 0.8;

function auditRulesNotification(
  t: (key: string, options?: Record<string, unknown>) => string,
  result: AuditRulesOutcome,
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
    case 'no-pending':
      return {
        type: 'message',
        message: t(
          'There are no pending rule hits to audit. New hits are recorded as approved rules categorize transactions.',
        ),
      };
    case 'ok': {
      const message = t(
        'Audit completed: {{audited}} audited, {{confirmed}} confirmed, {{corrected}} corrected, and {{skipped}} skipped.',
        {
          audited: result.audited,
          confirmed: result.confirmed,
          corrected: result.corrected,
          skipped: result.skipped,
        },
      );
      return result.failed > 0
        ? {
            type: 'warning',
            message: t(
              'Audit completed with {{failed}} failure(s): {{audited}} audited, {{confirmed}} confirmed, {{corrected}} corrected, and {{skipped}} skipped. Check the AI usage log for details.',
              {
                failed: result.failed,
                audited: result.audited,
                confirmed: result.confirmed,
                corrected: result.corrected,
                skipped: result.skipped,
              },
            ),
            button: {
              title: t('View AI usage log'),
              action: () => navigate('/ai-usage'),
            },
          }
        : { type: 'message', message };
    }
    default: {
      const exhaustive: never = result;
      throw new Error(
        `Unknown audit-rules outcome: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

function precisionOf(rule: AiRuleMetaEntity): number | null {
  return rule.hits > 0 ? rule.confirmed / rule.hits : null;
}

function isReviewCandidate(rule: AiRuleMetaEntity): boolean {
  const precision = precisionOf(rule);
  return (
    rule.hits >= REVIEW_CANDIDATE_MIN_HITS &&
    precision != null &&
    precision < REVIEW_CANDIDATE_MAX_PRECISION
  );
}

export function RuleHealthPanel() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAuditing, setIsAuditing] = useState(false);
  const { data: rules = [], isLoading } = useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => send('ai/get-rule-health'),
  });
  const { data } = useCategoriesById();
  const categoriesById = data?.list;

  const onAuditNow = async () => {
    setIsAuditing(true);
    try {
      const result = await send('ai/audit-rules');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['ai-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-usage-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-suggestions-index'] }),
      ]);
      dispatch(
        addNotification({
          notification: auditRulesNotification(t, result, navigate),
        }),
      );
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'The rule audit could not be completed. Check the AI usage log for details.',
            ),
            button: {
              title: t('View AI usage log'),
              action: () => navigate('/ai-usage'),
            },
          },
        }),
      );
    } finally {
      setIsAuditing(false);
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
          <Trans>Mined rule health</Trans>
        </Text>
        <ButtonWithLoading isLoading={isAuditing} onPress={onAuditNow}>
          <Trans>Audit now</Trans>
        </ButtonWithLoading>
      </View>
      {isLoading ? (
        <View style={{ alignItems: 'center', padding: '12px 0' }}>
          <AnimatedLoading width={20} color={theme.pageTextSubdued} />
        </View>
      ) : rules.length === 0 ? (
        <Text style={{ color: theme.pageTextSubdued, fontSize: '0.9em' }}>
          <Trans>
            No mined rules yet. Once you approve a proposal from the rule miner,
            its precision will be tracked here.
          </Trans>
        </Text>
      ) : (
        rules.map(rule => {
          const precision = precisionOf(rule);
          const flagged = isReviewCandidate(rule);
          const categoryName =
            categoriesById?.[rule.categoryId]?.name ?? rule.categoryId;

          return (
            <View
              key={rule.id}
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
                  {rule.payeeName} — {rule.op} "{rule.value}" → {categoryName}
                </Text>
                <Text
                  style={{ color: theme.pageTextSubdued, fontSize: '0.85em' }}
                >
                  {precision == null
                    ? t('No audited hits yet')
                    : t('{{precision}}% precision over {{hits}} audited hits', {
                        precision: Math.round(precision * 100),
                        hits: rule.hits,
                      })}
                </Text>
                {rule.recentFalsePositives &&
                  rule.recentFalsePositives.length > 0 && (
                    <View style={{ marginTop: 4, gap: 2 }}>
                      <Text
                        style={{
                          color: theme.warningText,
                          fontSize: '0.8em',
                          fontWeight: 600,
                        }}
                      >
                        <Trans>Recent false positives</Trans>
                      </Text>
                      {rule.recentFalsePositives.map(falsePositive => (
                        <Text
                          key={`${falsePositive.transactionId}-${falsePositive.auditedAt}`}
                          style={{
                            color: theme.pageTextSubdued,
                            fontSize: '0.8em',
                          }}
                        >
                          {falsePositive.payeeName ?? t('Unknown payee')}
                          {' — '}
                          {falsePositive.rationale ??
                            t('Category was corrected')}
                        </Text>
                      ))}
                    </View>
                  )}
              </View>
              {flagged && (
                <Text
                  style={{
                    color: theme.warningText,
                    backgroundColor: theme.warningBackground,
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: '0.8em',
                  }}
                >
                  <Trans>Review recommended</Trans>
                </Text>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}
