import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
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
import { css } from '@emotion/css';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { aiAgentLabel } from '#components/ai/labels';
import { Link } from '#components/common/Link';
import { FinancialText } from '#components/FinancialText';
import { FormField, FormLabel } from '#components/forms';
import { useCurrentAccess } from '#hooks/useCurrentAccess';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';
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
      return t('Frontier (advisor, complex planning)');
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
const BRAVE_SEARCH_SECRET_NAME = 'ai_brave_search_key';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function formatUsd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
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
        color: nossoCaderninho.color.balance,
        backgroundColor: nossoCaderninho.color.balanceSoft,
        borderRadius: nossoCaderninho.radius.control,
        padding: '1px 6px',
        fontSize: '0.75em',
      }}
    >
      <Trans>Configured</Trans>
    </Text>
  );
}

export function AiSettings() {
  const { i18n, t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const locale = i18n.resolvedLanguage ?? 'en';
  const dispatch = useDispatch();
  const { cloudFileId } = useCurrentAccess();
  const queryClient = useQueryClient();

  const { data: savedConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => send('ai/get-config'),
  });

  const { data: usage, isLoading: isUsageLoading } = useQuery({
    queryKey: ['ai-usage-summary'],
    queryFn: () =>
      send('ai/get-usage-summary', { sinceMs: Date.now() - THIRTY_DAYS_MS }),
  });

  const {
    data: secretsStatus,
    isError: isSecretsStatusError,
    isLoading: isSecretsStatusLoading,
  } = useQuery({
    queryKey: ['ai-secrets-status', cloudFileId],
    queryFn: () => send('ai/get-secrets-status', { fileId: cloudFileId }),
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
    return (
      <View style={{ alignItems: 'center', padding: 20 }}>
        {isConfigLoading ? (
          <AnimatedLoading width={20} color={theme.pageTextSubdued} />
        ) : (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>AI settings are unavailable right now.</Trans>
          </Text>
        )}
      </View>
    );
  }

  const onSaveConfig = async () => {
    if (isSavingConfig) {
      return;
    }

    setIsSavingConfig(true);
    try {
      await send('ai/update-config', config);
      await queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to save AI settings.'),
          },
        }),
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  const onSaveKeys = async () => {
    if (isSavingKeys) {
      return;
    }

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

      if (apiKeys.braveSearch) {
        const result =
          (await send('secret-set', {
            name: BRAVE_SEARCH_SECRET_NAME,
            value: apiKeys.braveSearch,
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
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to save API keys.'),
          },
        }),
      );
    } finally {
      setIsSavingKeys(false);
    }
  };

  return (
    <Setting
      primaryAction={
        <ButtonWithLoading
          isDisabled={isSavingConfig}
          isLoading={isSavingConfig}
          onPress={onSaveConfig}
        >
          <Trans>Save AI settings</Trans>
        </ButtonWithLoading>
      }
    >
      <View className={toggleSettingClass}>
        <Text>
          <Trans>
            <strong>AI features</strong> — hybrid rule + AI transaction
            classification, rule mining and auditing. Disabled by default; no
            transaction data is sent anywhere until this is turned on.
          </Trans>
        </Text>
        <Toggle
          id="ai-enabled"
          className={toggleControlClass}
          isOn={config.enabled}
          onToggle={() => setConfig({ ...config, enabled: !config.enabled })}
        />
      </View>

      <View className={toggleSettingClass}>
        <Text>
          <Trans>
            <strong>Research unclear merchants on the web</strong> — when local
            history is insufficient, send a redacted merchant query through the
            sync-server to Brave Search. Off by default.
          </Trans>
        </Text>
        <Toggle
          id="ai-web-search"
          className={toggleControlClass}
          isOn={config.webSearchEnabled ?? false}
          onToggle={() =>
            setConfig({
              ...config,
              webSearchEnabled: !(config.webSearchEnabled ?? false),
            })
          }
        />
      </View>

      {config.webSearchEnabled && (
        <FormField style={{ width: '100%' }}>
          <FormLabel title={t('Maximum web searches per classifier batch')} />
          <Input
            value={String(config.maxWebSearchesPerBatch ?? 3)}
            onChangeValue={value => {
              const parsed = Number(value);
              if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 5) {
                setConfig({ ...config, maxWebSearchesPerBatch: parsed });
              }
            }}
          />
        </FormField>
      )}

      {TIERS.map(tier => (
        <View
          key={tier}
          style={{
            flexDirection: isNarrowWidth ? 'column' : 'row',
            alignItems: isNarrowWidth ? 'stretch' : 'center',
            gap: 8,
            width: '100%',
          }}
        >
          <Text
            style={{
              width: isNarrowWidth ? 'auto' : 260,
              color: theme.pageTextSubdued,
            }}
          >
            {tierLabel(t, tier)}
          </Text>
          <View style={{ width: isNarrowWidth ? '100%' : 'auto' }}>
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
          </View>
          <Input
            value={config.tiers[tier].model}
            placeholder={t('model id')}
            style={{ width: isNarrowWidth ? '100%' : undefined }}
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
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
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

      <View className={toggleSettingClass}>
        <Text>
          <Trans>
            <strong>Redact sensitive data</strong> — strip CPF/CNPJ, card
            numbers and PIX keys from transaction text before it is sent to any
            AI provider.
          </Trans>
        </Text>
        <Toggle
          id="ai-redact-pii"
          className={toggleControlClass}
          isOn={config.redactPii}
          onToggle={() =>
            setConfig({ ...config, redactPii: !config.redactPii })
          }
        />
      </View>

      <View className={toggleSettingClass}>
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
          className={toggleControlClass}
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
          borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
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
                isSecretsStatusLoading
                  ? t('Loading…')
                  : isSecretsStatusError
                    ? t('Unavailable')
                    : secretsStatus?.[secretName as keyof typeof secretsStatus]
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
              isSecretsStatusLoading
                ? t('Loading…')
                : isSecretsStatusError
                  ? t('Unavailable')
                  : secretsStatus?.ai_ollama_baseUrl
                    ? t('Configured — leave blank to keep it')
                    : t('Not set')
            }
            onChangeValue={setOllamaBaseUrl}
          />
        </FormField>

        <FormField style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FormLabel title={t('Brave Search API key')} />
            {secretsStatus?.ai_brave_search_key && <ConfiguredBadge />}
          </View>
          <Input
            type="password"
            value={apiKeys.braveSearch ?? ''}
            placeholder={
              isSecretsStatusLoading
                ? t('Loading…')
                : isSecretsStatusError
                  ? t('Unavailable')
                  : secretsStatus?.ai_brave_search_key
                    ? t('Configured — leave blank to keep it')
                    : t('Not set')
            }
            onChangeValue={value =>
              setApiKeys({ ...apiKeys, braveSearch: value })
            }
          />
        </FormField>

        {keysError && (
          <Text style={{ color: nossoCaderninho.color.limit }}>
            {keysError}
          </Text>
        )}

        <ButtonWithLoading
          isDisabled={isSavingKeys}
          isLoading={isSavingKeys}
          onPress={onSaveKeys}
        >
          <Trans>Save API keys</Trans>
        </ButtonWithLoading>
      </View>

      <View
        style={{
          width: '100%',
          borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
          paddingTop: 10,
        }}
      >
        <View
          style={{
            flexDirection: isNarrowWidth ? 'column' : 'row',
            alignItems: isNarrowWidth ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: 600 }}>
            <Trans>AI spend, last 30 days</Trans>
          </Text>
          {/* Always reachable, even before this summary has loaded — this is
              the only link to /ai-usage in the whole app, and three separate
              error messages tell the user to "check the AI usage log"
              without one, if this were still gated on `usage`. */}
          <Link variant="button" to="/ai-usage">
            <Trans>View call-by-call usage</Trans>
          </Link>
        </View>
        {isUsageLoading ? (
          <AnimatedLoading width={20} color={theme.pageTextSubdued} />
        ) : usage ? (
          <>
            <FinancialText>
              {formatUsd(usage.totalCostUsd, locale)}
            </FinancialText>
            {Object.entries(usage.byAgent).map(([agent, cost]) => (
              <Text key={agent} style={{ color: theme.pageTextSubdued }}>
                {aiAgentLabel(agent, t)}:{' '}
                <FinancialText as="span">
                  {formatUsd(cost, locale)}
                </FinancialText>
              </Text>
            ))}
          </>
        ) : (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>Usage summary is unavailable right now.</Trans>
          </Text>
        )}
      </View>
    </Setting>
  );
}

const toggleSettingClass = css({
  width: '100%',
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 44px',
  alignItems: 'center',
  gap: nossoCaderninho.space.md,
});

const toggleControlClass = css({
  width: 44,
  height: 44,
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
});
