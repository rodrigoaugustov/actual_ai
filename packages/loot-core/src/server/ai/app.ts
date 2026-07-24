import { createApp } from '#server/app';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import type {
  AiConfig,
  AiRuleMetaEntity,
  AiRunEntity,
  AiSuggestionForReview,
  AiSuggestionIndexEntry,
  ClassifyOutcome,
  MineRulesOutcome,
} from '#types/models/ai';

import { auditApprovedRules } from './auditor';
import { classifyTransactionsById } from './classify';
import { getAiConfig, setAiConfig } from './config';
import {
  getRuleHealth,
  getRuleProposals,
  resolveRuleProposal,
} from './rule-meta';
import { mineRuleProposals } from './rule-miner';
import { getRecentRuns, getUsageSummary } from './runs';
import type { UsageSummary } from './runs';
import { getConfiguredSecrets } from './secrets-status';
import type { ConfiguredSecrets } from './secrets-status';
import {
  getPendingSuggestions,
  getSuggestionsIndex,
  resolveSuggestion,
} from './suggestions';

export type AiHandlers = {
  'ai/get-config': typeof getConfig;
  'ai/update-config': typeof updateConfig;
  'ai/get-usage-summary': typeof getUsageSummaryHandler;
  'ai/get-runs': typeof getRunsHandler;
  'ai/get-suggestions': typeof getSuggestionsHandler;
  'ai/get-suggestions-index': typeof getSuggestionsIndexHandler;
  'ai/resolve-suggestion': typeof resolveSuggestionHandler;
  'ai/classify-now': typeof classifyNowHandler;
  'ai/mine-rules': typeof mineRulesHandler;
  'ai/get-rule-proposals': typeof getRuleProposalsHandler;
  'ai/resolve-rule-proposal': typeof resolveRuleProposalHandler;
  'ai/audit-rules': typeof auditRulesHandler;
  'ai/get-rule-health': typeof getRuleHealthHandler;
  'ai/get-secrets-status': typeof getSecretsStatusHandler;
};

export const app = createApp<AiHandlers>();
app.method('ai/get-config', getConfig);
app.method('ai/update-config', mutator(undoable(updateConfig)));
app.method('ai/get-usage-summary', getUsageSummaryHandler);
app.method('ai/get-runs', getRunsHandler);
app.method('ai/get-suggestions', getSuggestionsHandler);
app.method('ai/get-suggestions-index', getSuggestionsIndexHandler);
app.method(
  'ai/resolve-suggestion',
  mutator(undoable(resolveSuggestionHandler)),
);
app.method('ai/classify-now', mutator(undoable(classifyNowHandler)));
app.method('ai/mine-rules', mineRulesHandler);
app.method('ai/get-rule-proposals', getRuleProposalsHandler);
app.method(
  'ai/resolve-rule-proposal',
  mutator(undoable(resolveRuleProposalHandler)),
);
app.method('ai/audit-rules', auditRulesHandler);
app.method('ai/get-rule-health', getRuleHealthHandler);
app.method('ai/get-secrets-status', getSecretsStatusHandler);

export async function getConfig(): Promise<AiConfig> {
  return getAiConfig();
}

export async function updateConfig(config: AiConfig): Promise<void> {
  await setAiConfig(config);
}

export async function getUsageSummaryHandler({
  sinceMs,
}: {
  sinceMs: number;
}): Promise<UsageSummary> {
  return getUsageSummary(sinceMs);
}

export async function getSuggestionsHandler(): Promise<
  AiSuggestionForReview[]
> {
  return getPendingSuggestions();
}

export async function getRunsHandler(): Promise<AiRunEntity[]> {
  return getRecentRuns();
}

export async function getSuggestionsIndexHandler(): Promise<
  AiSuggestionIndexEntry[]
> {
  return getSuggestionsIndex();
}

export async function resolveSuggestionHandler(params: {
  id: string;
  action: 'accept' | 'correct' | 'reject';
  correctedCategoryId?: string | null;
}): Promise<void> {
  return resolveSuggestion(params);
}

export async function classifyNowHandler({
  transactionIds,
}: {
  transactionIds: string[];
}): Promise<ClassifyOutcome> {
  return classifyTransactionsById(transactionIds);
}

export async function mineRulesHandler(): Promise<MineRulesOutcome> {
  return mineRuleProposals();
}

export async function getRuleProposalsHandler(): Promise<AiRuleMetaEntity[]> {
  return getRuleProposals();
}

export async function resolveRuleProposalHandler(params: {
  id: string;
  action: 'approve' | 'reject';
}): Promise<void> {
  return resolveRuleProposal(params);
}

export async function auditRulesHandler(): Promise<void> {
  return auditApprovedRules();
}

export async function getRuleHealthHandler(): Promise<AiRuleMetaEntity[]> {
  return getRuleHealth();
}

export async function getSecretsStatusHandler({
  fileId,
}: {
  fileId?: string | null;
} = {}): Promise<ConfiguredSecrets> {
  return getConfiguredSecrets(fileId);
}
