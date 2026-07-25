import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  AiConfig,
  AiProviderId,
  AiTier,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { RuleHealthPanel } from '#components/ai/RuleHealthPanel';
import { RuleProposalsPanel } from '#components/ai/RuleProposalsPanel';
import { Link } from '#components/common/Link';
import { FinancialText } from '#components/FinancialText';
import { FormField, FormLabel } from '#components/forms';
import { useCurrentAccess } from '#hooks/useCurrentAccess';
import { getSecretsError } from '#util/error';

import { Setting } from './UI';

const TIERS: AiTier[] = ['fast', 'standard', 'frontier'];

function tierLabel(t: (key: string) => string, tier: AiTier): string {
  switch (tier) {
    case 'fast':
      return t('Fast (auditing, cheap checks)');
    case 'standard':
      return t('Standard (classification, rule mining)');
    case 'frontier':
      return t('Frontier (advisor, wizard)');
    default:
      return tier;
  }
}

const PROVIDER_OPTIONS: Array<[AiProviderId, string]> = [
  ['openai', 'OpenAI'],
  ['anthropic', 'Anthropic'],
  ['google', 'Google'],
  ['openrouter', 'OpenRouter'],
  ['ollama', 'Ollama (local)'],
];

const PROVIDER_SECRET_NAMES: Partial<Record<AiProviderId, string>> = {
  openai: 'ai_openai_key',
  anthropic: 'ai_anthropic_key',
  google: 'ai_google_key',
  openrouter: 'ai_openrouter_key',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

// The secrets endpoint never returns the stored value back to the client
// (same as every other bank-sync credential in this app), so this is the
// only feedback the user gets that a save actually took — without it, an
// already-configured field looks indistinguishable from an unset one.
function ConfiguredBadge() {
  return (
    <Text
      style={{
        color: theme.noticeText,
        backgroundColor: theme.noticeBackground,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: '0.75em',
      }}
    >
      <Trans>Configured</Trans>
    </Text>
  );
}

export function AiSettings() {
  const { t } = useTranslation();
  const { cloudFileId } = useCurrentAccess();
  const queryClient = useQueryClient();

  const { data: savedConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => send('ai/get-config'),
  });

  const { data: usage } = useQuery({
    queryKey: ['ai-usage-summary'],
    queryFn: () =>
      send('ai/get-usage-summary', { sinceMs: Date.now() - THIRTY_DAYS_MS }),
  });

  const { data: secretsStatus } = useQuery({
    queryKey: ['ai-secrets-status', cloudFileId],
    queryFn: () => send('ai/get-secrets-status', { fileId: cloudFileId }),
  });

  const { data: pendingSuggestions = [] } = useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: () => send('ai/get-suggestions'),
  });

  const [config, setConfig] = useState<AiConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);

  useEffect(() => {
    if (savedConfig && !config) {
      setConfig(savedConfig);
    }
  }, [savedConfig, config]);

  if (!config) {
    return null;
  }

  const onSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await send('ai/update-config', config);
      await queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const onSaveKeys = async () => {
    setIsSavingKeys(true);
    setKeysError(null);
    try {
      for (const [provider, secretName] of Object.entries(
        PROVIDER_SECRET_NAMES,
      )) {
        const value = apiKeys[provider];
        if (!value) continue;

        const result =
          (await send('secret-set', {
            name: secretName,
            value,
            fileId: cloudFileId,
          })) || {};
        if (result.error) {
          setKeysError(getSecretsError(result.error, result.reason));
          return;
        }
      }

      if (ollamaBaseUrl) {
        const result =
          (await send('secret-set', {
            name: 'ai_ollama_baseUrl',
            value: ollamaBaseUrl,
            fileId: cloudFileId,
          })) || {};
        if (result.error) {
          setKeysError(getSecretsError(result.error, result.reason));
          return;
        }
      }

      setApiKeys({});
      setOllamaBaseUrl('');
      await queryClient.invalidateQueries({
        queryKey: ['ai-secrets-status', cloudFileId],
      });
    } finally {
      setIsSavingKeys(false);
    }
  };

  return (
    <Setting
      primaryAction={
        <ButtonWithLoading isLoading={isSavingConfig} onPress={onSaveConfig}>
          <Trans>Save AI settings</Trans>
        </ButtonWithLoading>
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text>
          <Trans>
            <strong>AI features</strong> — hybrid rule + AI transaction
            classification, rule mining and auditing. Disabled by default; no
            transaction data is sent anywhere until this is turned on.
          </Trans>
        </Text>
        <Toggle
          id="ai-enabled"
          isOn={config.enabled}
          onToggle={() => setConfig({ ...config, enabled: !config.enabled })}
        />
      </View>

      {config.enabled && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Text>
            {pendingSuggestions.length > 0
              ? t('{{count}} AI categorization(s) awaiting your review.', {
                  count: pendingSuggestions.length,
                })
              : t('No AI categorizations awaiting review right now.')}
          </Text>
          <Link
            variant="button"
            buttonVariant="primary"
            to="/ai-pending-categorizations"
          >
            <Trans>Review categorizations</Trans>
          </Link>
        </View>
      )}
      {config.enabled && <RuleProposalsPanel />}
      {config.enabled && <RuleHealthPanel />}

      {TIERS.map(tier => (
        <View
          key={tier}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            width: '100%',
          }}
        >
          <Text style={{ width: 260, color: theme.pageTextSubdued }}>
            {tierLabel(t, tier)}
          </Text>
          <Select
            aria-label={t('Provider for {{tier}}', { tier })}
            options={PROVIDER_OPTIONS}
            value={config.tiers[tier].provider}
            onChange={value =>
              setConfig({
                ...config,
                tiers: {
                  ...config.tiers,
                  [tier]: {
                    ...config.tiers[tier],
                    provider: value as AiProviderId,
                  },
                },
              })
            }
          />
          <Input
            value={config.tiers[tier].model}
            placeholder={t('model id')}
            onChangeValue={value =>
              setConfig({
                ...config,
                tiers: {
                  ...config.tiers,
                  [tier]: { ...config.tiers[tier], model: value },
                },
              })
            }
          />
        </View>
      ))}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
        }}
      >
        <FormField style={{ flex: 1 }}>
          <FormLabel title={t('Auto-apply confidence threshold (0-1)')} />
          <Input
            value={String(config.confidenceThreshold)}
            onChangeValue={value => {
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                setConfig({ ...config, confidenceThreshold: parsed });
              }
            }}
          />
        </FormField>
        <FormField style={{ flex: 1 }}>
          <FormLabel title={t('Max AI spend per day (USD)')} />
          <Input
            value={String(config.maxCostPerDayUsd ?? '')}
            onChangeValue={value => {
              const parsed = Number(value);
              setConfig({
                ...config,
                maxCostPerDayUsd: Number.isNaN(parsed) ? undefined : parsed,
              });
            }}
          />
        </FormField>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text>
          <Trans>
            <strong>Redact sensitive data</strong> — strip CPF/CNPJ, card
            numbers and PIX keys from transaction text before it is sent to any
            AI provider.
          </Trans>
        </Text>
        <Toggle
          id="ai-redact-pii"
          isOn={config.redactPii}
          onToggle={() =>
            setConfig({ ...config, redactPii: !config.redactPii })
          }
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text>
          <Trans>
            <strong>Share sensitive advisor memories</strong> — include
            confirmed profile facts marked as sensitive in requests to the AI
            provider. Off by default; those facts remain stored locally and
            synchronized with your budget.
          </Trans>
        </Text>
        <Toggle
          id="ai-share-sensitive-memory"
          isOn={config.shareSensitiveMemoryWithProvider ?? false}
          onToggle={() =>
            setConfig({
              ...config,
              shareSensitiveMemoryWithProvider: !(
                config.shareSensitiveMemoryWithProvider ?? false
              ),
            })
          }
        />
      </View>

      <View
        style={{
          width: '100%',
          borderTop: '1px solid ' + theme.pillBorderDark,
          paddingTop: 10,
        }}
      >
        <Text style={{ fontWeight: 600 }}>
          <Trans>API keys</Trans>
        </Text>
        <Text style={{ color: theme.pageTextSubdued, marginBottom: 8 }}>
          <Trans>
            Keys are stored on your sync server, never on this device, and only
            used by its proxy to talk to each provider.
          </Trans>
        </Text>

        {Object.entries(PROVIDER_SECRET_NAMES).map(([provider, secretName]) => (
          <FormField key={provider} style={{ marginBottom: 6 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <FormLabel
                title={
                  PROVIDER_OPTIONS.find(([value]) => value === provider)?.[1] ??
                  provider
                }
              />
              {secretsStatus?.[secretName as keyof typeof secretsStatus] && (
                <ConfiguredBadge />
              )}
            </View>
            <Input
              type="password"
              placeholder={
                secretsStatus?.[secretName as keyof typeof secretsStatus]
                  ? t('Configured — leave blank to keep it')
                  : t('Not set')
              }
              value={apiKeys[provider] ?? ''}
              onChangeValue={value =>
                setApiKeys({ ...apiKeys, [provider]: value })
              }
            />
          </FormField>
        ))}

        <FormField style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FormLabel
              title={t('Ollama host (e.g. http://192.168.1.50:11434)')}
            />
            {secretsStatus?.ai_ollama_baseUrl && <ConfiguredBadge />}
          </View>
          <Input
            value={ollamaBaseUrl}
            placeholder={
              secretsStatus?.ai_ollama_baseUrl
                ? t('Configured — leave blank to keep it')
                : t('Not set')
            }
            onChangeValue={setOllamaBaseUrl}
          />
        </FormField>

        {keysError && (
          <Text style={{ color: theme.errorText }}>{keysError}</Text>
        )}

        <ButtonWithLoading isLoading={isSavingKeys} onPress={onSaveKeys}>
          <Trans>Save API keys</Trans>
        </ButtonWithLoading>
      </View>

      {usage && (
        <View
          style={{
            width: '100%',
            borderTop: '1px solid ' + theme.pillBorderDark,
            paddingTop: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontWeight: 600 }}>
              <Trans>AI spend, last 30 days</Trans>
            </Text>
            <Link variant="button" to="/ai-usage">
              <Trans>View call-by-call usage</Trans>
            </Link>
          </View>
          <FinancialText>{formatUsd(usage.totalCostUsd)}</FinancialText>
          {Object.entries(usage.byAgent).map(([agent, cost]) => (
            <Text key={agent} style={{ color: theme.pageTextSubdued }}>
              {agent}:{' '}
              <FinancialText as="span">{formatUsd(cost)}</FinancialText>
            </Text>
          ))}
        </View>
      )}
    </Setting>
  );
}
