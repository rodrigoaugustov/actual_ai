import { ErrorBoundary } from 'react-error-boundary';
import { Trans, useTranslation } from 'react-i18next';

import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { MobilePageHeader, Page } from '#components/Page';

import { RuleHealthPanel } from './RuleHealthPanel';
import { RuleProposalsPanel } from './RuleProposalsPanel';
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

type PendingCategorizationsPageProps = {
  isMobile?: boolean;
};

export function PendingCategorizationsPage({
  isMobile = false,
}: PendingCategorizationsPageProps = {}) {
  const { t } = useTranslation();
  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <Page
        header={
          isMobile ? (
            <MobilePageHeader title={t('Pending AI Categorizations')} />
          ) : (
            t('Pending AI Categorizations')
          )
        }
        padding={isMobile ? 0 : undefined}
      >
        <View
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: isMobile ? 12 : 0,
            paddingBottom: isMobile ? MOBILE_NAV_HEIGHT : 12,
          }}
        >
          <PendingCountBanner />
          <Text style={{ color: theme.pageTextSubdued, marginBottom: 12 }}>
            <Trans>
              Transactions the AI classifier wasn't confident enough to
              auto-apply. Accept a suggestion to apply the suggested category,
              or reject it to leave the transaction uncategorized.
            </Trans>
          </Text>
          <SuggestionsInbox isMobile={isMobile} />
          <View style={{ marginTop: 18, gap: 12 }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>
                <Trans>Automation and rule health</Trans>
              </Text>
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>
                  Review proposed automations and inspect rules that may need
                  attention.
                </Trans>
              </Text>
            </View>
            <RuleProposalsPanel />
            <RuleHealthPanel />
          </View>
        </View>
      </Page>
    </ErrorBoundary>
  );
}

export function MobilePendingCategorizationsPage() {
  return <PendingCategorizationsPage isMobile />;
}
