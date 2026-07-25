import { ErrorBoundary } from 'react-error-boundary';
import { Trans, useTranslation } from 'react-i18next';

import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { Page } from '#components/Page';

import { SuggestionsInbox } from './SuggestionsInbox';

function PendingCountBanner() {
  const { t } = useTranslation();
  const {
    data: suggestions = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: () => send('ai/get-suggestions'),
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 4,
        backgroundColor:
          suggestions.length > 0
            ? theme.warningBackground
            : theme.noticeBackground,
        color: suggestions.length > 0 ? theme.warningText : theme.noticeText,
        marginBottom: 12,
      }}
    >
      {isLoading ? (
        <AnimatedLoading width={20} color={theme.pageTextSubdued} />
      ) : isError ? (
        <Text style={{ fontWeight: 600 }}>
          <Trans>Could not load pending AI categorizations.</Trans>
        </Text>
      ) : (
        <Text style={{ fontWeight: 600 }}>
          {suggestions.length > 0
            ? t('{{count}} categorization(s) awaiting your review.', {
                count: suggestions.length,
              })
            : t('No pending categorizations right now.')}
        </Text>
      )}
    </View>
  );
}

export function PendingCategorizationsPage() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <Page header={t('Pending AI Categorizations')}>
        <PendingCountBanner />
        <Text style={{ color: theme.pageTextSubdued, marginBottom: 12 }}>
          <Trans>
            Transactions the AI classifier wasn't confident enough to
            auto-apply. Accept a suggestion to apply the suggested category, or
            reject it to leave the transaction uncategorized.
          </Trans>
        </Text>
        <SuggestionsInbox />
      </Page>
    </ErrorBoundary>
  );
}
