import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { AiRuleMetaEntity } from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCategoriesById } from '#hooks/useCategories';

const HEALTH_QUERY_KEY = ['ai-rule-health'];
const REVIEW_CANDIDATE_MIN_HITS = 5;
const REVIEW_CANDIDATE_MAX_PRECISION = 0.8;

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
  const queryClient = useQueryClient();
  const [isAuditing, setIsAuditing] = useState(false);
  const { data: rules = [] } = useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => send('ai/get-rule-health'),
  });
  const { data } = useCategoriesById();
  const categoriesById = data?.list;

  if (rules.length === 0) {
    return null;
  }

  const onAuditNow = async () => {
    setIsAuditing(true);
    try {
      await send('ai/audit-rules');
      await queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
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
      {rules.map(rule => {
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
      })}
    </View>
  );
}
