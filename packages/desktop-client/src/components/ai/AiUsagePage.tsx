import { ErrorBoundary } from 'react-error-boundary';
import { Trans, useTranslation } from 'react-i18next';

import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { AiRunEntity } from '@actual-app/core/types/models';
import { useQuery } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { useDateFormat } from '#hooks/useDateFormat';

import { aiAgentLabel, aiRunStatusLabel, aiTierLabel } from './labels';

function formatUsd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

const HEADER_STYLE = {
  fontWeight: 600,
  color: theme.pageTextSubdued,
  fontSize: '0.85em',
};

function SummaryBar({ runs }: { runs: AiRunEntity[] }) {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en';
  const totalCostUsd = runs.reduce((sum, run) => sum + run.costUsd, 0);
  const failedCount = runs.filter(run => run.status === 'error').length;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 20,
        padding: '8px 12px',
        borderRadius: 4,
        backgroundColor: theme.noticeBackground,
        color: theme.noticeText,
        marginBottom: 12,
      }}
    >
      <Text>{t('{{count}} calls shown', { count: runs.length })}</Text>
      <Text>
        <Trans>Total cost:</Trans>{' '}
        <FinancialText as="span">
          {formatUsd(totalCostUsd, locale)}
        </FinancialText>
      </Text>
      {failedCount > 0 && (
        <Text style={{ color: theme.errorText }}>
          {t('{{count}} failed', { count: failedCount })}
        </Text>
      )}
    </View>
  );
}

function RunRow({ run }: { run: AiRunEntity }) {
  const { i18n, t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const locale = i18n.resolvedLanguage ?? 'en';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid ' + theme.pillBorderDark,
      }}
    >
      <Text style={{ width: 140, color: theme.pageTextSubdued }}>
        {formatDate(new Date(run.createdAt), `${dateFormat} HH:mm`)}
      </Text>
      <Text style={{ width: 110 }}>{aiAgentLabel(run.agent, t)}</Text>
      <Text style={{ width: 90, color: theme.pageTextSubdued }}>
        {aiTierLabel(run.tier, t)}
      </Text>
      <Text style={{ width: 180 }}>
        {run.provider} · {run.model}
      </Text>
      <FinancialText style={{ width: 110, textAlign: 'right' }}>
        {run.inputTokens.toLocaleString(locale)} →{' '}
        {run.outputTokens.toLocaleString(locale)}
      </FinancialText>
      <FinancialText style={{ width: 90, textAlign: 'right' }}>
        {formatUsd(run.costUsd, locale)}
      </FinancialText>
      <FinancialText style={{ width: 80, textAlign: 'right' }}>
        {new Intl.NumberFormat(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(run.durationMs / 1000)}
        s
      </FinancialText>
      <Text
        style={{
          width: 70,
          color: run.status === 'error' ? theme.errorText : theme.noticeText,
        }}
      >
        {aiRunStatusLabel(run.status, t)}
      </Text>
    </View>
  );
}

export function AiUsagePage() {
  const { t } = useTranslation();
  const {
    data: runs = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['ai-runs'],
    queryFn: () => send('ai/get-runs'),
  });

  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <Page header={t('AI Usage')}>
        <Text style={{ color: theme.pageTextSubdued, marginBottom: 12 }}>
          <Trans>
            Every AI call this budget has made — tokens, model, duration and
            cost — most recent first. Use it to judge which provider/model is
            actually worth what it costs.
          </Trans>
        </Text>
        {isLoading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <AnimatedLoading width={20} color={theme.pageTextSubdued} />
          </View>
        ) : isError ? (
          <Text style={{ color: theme.errorText }}>
            <Trans>Could not load AI usage.</Trans>
          </Text>
        ) : (
          <>
            <SummaryBar runs={runs} />
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                padding: '4px 0',
                borderBottom: '2px solid ' + theme.pillBorderDark,
              }}
            >
              <Text style={{ ...HEADER_STYLE, width: 140 }}>
                <Trans>When</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 110 }}>
                <Trans>Agent</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 90 }}>
                <Trans>Tier</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 180 }}>
                <Trans>Provider · model</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 110, textAlign: 'right' }}>
                <Trans>Tokens in → out</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 90, textAlign: 'right' }}>
                <Trans>Cost</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 80, textAlign: 'right' }}>
                <Trans>Duration</Trans>
              </Text>
              <Text style={{ ...HEADER_STYLE, width: 70 }}>
                <Trans>Status</Trans>
              </Text>
            </View>
            {runs.length === 0 && (
              <Text style={{ color: theme.pageTextSubdued, marginTop: 8 }}>
                <Trans>No AI calls recorded yet.</Trans>
              </Text>
            )}
            {runs.map(run => (
              <RunRow key={run.id} run={run} />
            ))}
          </>
        )}
      </Page>
    </ErrorBoundary>
  );
}
