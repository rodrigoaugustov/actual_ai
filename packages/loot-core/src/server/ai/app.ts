import { createApp } from '#server/app';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import type {
  AiAdviceRecordEntity,
  AiCategoryProfileEntity,
  AiConfig,
  AiConversationEntity,
  AiDocumentEntity,
  AiGoalEntity,
  AiMemoryFactEntity,
  AiMemoryFactStatus,
  AiMessageEntity,
  AiRuleMetaEntity,
  AiRunEntity,
  AiSuggestionForReview,
  AiSuggestionIndexEntry,
  AuditRulesOutcome,
  ClassifyOutcome,
  MineRulesOutcome,
} from '#types/models/ai';

import { cancelAdvisorRun, startAdvisorRun } from './advisor';
import type { StartAdvisorRunOutcome } from './advisor';
import {
  createAdviceRecord,
  createConversation,
  createDocument,
  createGoal,
  createMemoryCandidate,
  deleteAdviceRecord,
  deleteConversation,
  deleteDocument,
  deleteGoal,
  deleteMemoryFact,
  listAdviceRecords,
  listConversationMessages,
  listConversations,
  listDocuments,
  listGoals,
  listMemoryFacts,
  resolveMemoryFact,
  updateAdviceRecord,
  updateConversation,
  updateDocument,
  updateGoal,
} from './advisor-memory';
import { auditApprovedRules } from './auditor';
import {
  listCategoryProfiles,
  upsertCategoryProfile,
} from './category-profiles';
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
  'ai/get-category-profiles': typeof getCategoryProfilesHandler;
  'ai/update-category-profile': typeof updateCategoryProfileHandler;
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
  'ai/advisor/start': typeof startAdvisorHandler;
  'ai/advisor/cancel': typeof cancelAdvisorHandler;
  'ai/advisor/create-conversation': typeof createConversationHandler;
  'ai/advisor/list-conversations': typeof listConversationsHandler;
  'ai/advisor/update-conversation': typeof updateConversation;
  'ai/advisor/delete-conversation': typeof deleteConversationHandler;
  'ai/advisor/list-messages': typeof listMessagesHandler;
  'ai/advisor/list-memory': typeof listMemoryHandler;
  'ai/advisor/create-memory': typeof createMemoryHandler;
  'ai/advisor/resolve-memory': typeof resolveMemoryFact;
  'ai/advisor/delete-memory': typeof deleteMemoryHandler;
  'ai/advisor/list-goals': typeof listGoalsHandler;
  'ai/advisor/create-goal': typeof createGoal;
  'ai/advisor/update-goal': typeof updateGoal;
  'ai/advisor/delete-goal': typeof deleteGoalHandler;
  'ai/advisor/list-documents': typeof listDocumentsHandler;
  'ai/advisor/create-document': typeof createDocument;
  'ai/advisor/update-document': typeof updateDocument;
  'ai/advisor/delete-document': typeof deleteDocumentHandler;
  'ai/advisor/list-advice': typeof listAdviceHandler;
  'ai/advisor/create-advice': typeof createAdviceRecord;
  'ai/advisor/update-advice': typeof updateAdviceRecord;
  'ai/advisor/delete-advice': typeof deleteAdviceHandler;
};

export const app = createApp<AiHandlers>();
app.method('ai/get-config', getConfig);
app.method('ai/update-config', mutator(undoable(updateConfig)));
app.method('ai/get-category-profiles', getCategoryProfilesHandler);
app.method(
  'ai/update-category-profile',
  mutator(undoable(updateCategoryProfileHandler)),
);
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
app.method('ai/advisor/start', startAdvisorHandler);
app.method('ai/advisor/cancel', cancelAdvisorHandler);
app.method(
  'ai/advisor/create-conversation',
  mutator(undoable(createConversationHandler)),
);
app.method('ai/advisor/list-conversations', listConversationsHandler);
app.method(
  'ai/advisor/update-conversation',
  mutator(undoable(updateConversation)),
);
app.method(
  'ai/advisor/delete-conversation',
  mutator(undoable(deleteConversationHandler)),
);
app.method('ai/advisor/list-messages', listMessagesHandler);
app.method('ai/advisor/list-memory', listMemoryHandler);
app.method('ai/advisor/create-memory', mutator(undoable(createMemoryHandler)));
app.method('ai/advisor/resolve-memory', mutator(undoable(resolveMemoryFact)));
app.method('ai/advisor/delete-memory', mutator(undoable(deleteMemoryHandler)));
app.method('ai/advisor/list-goals', listGoalsHandler);
app.method('ai/advisor/create-goal', mutator(undoable(createGoal)));
app.method('ai/advisor/update-goal', mutator(undoable(updateGoal)));
app.method('ai/advisor/delete-goal', mutator(undoable(deleteGoalHandler)));
app.method('ai/advisor/list-documents', listDocumentsHandler);
app.method('ai/advisor/create-document', mutator(undoable(createDocument)));
app.method('ai/advisor/update-document', mutator(undoable(updateDocument)));
app.method(
  'ai/advisor/delete-document',
  mutator(undoable(deleteDocumentHandler)),
);
app.method('ai/advisor/list-advice', listAdviceHandler);
app.method('ai/advisor/create-advice', mutator(undoable(createAdviceRecord)));
app.method('ai/advisor/update-advice', mutator(undoable(updateAdviceRecord)));
app.method('ai/advisor/delete-advice', mutator(undoable(deleteAdviceHandler)));

export async function getConfig(): Promise<AiConfig> {
  return getAiConfig();
}

export async function updateConfig(config: AiConfig): Promise<void> {
  await setAiConfig(config);
}

export async function getCategoryProfilesHandler(): Promise<
  AiCategoryProfileEntity[]
> {
  return listCategoryProfiles();
}

export async function updateCategoryProfileHandler(params: {
  categoryId: string;
  description: string;
}): Promise<AiCategoryProfileEntity | null> {
  return upsertCategoryProfile(params);
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

export async function auditRulesHandler(): Promise<AuditRulesOutcome> {
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

export async function startAdvisorHandler(params: {
  conversationId: string;
  message: string;
}): Promise<StartAdvisorRunOutcome> {
  return startAdvisorRun(params);
}

export async function cancelAdvisorHandler({
  runId,
}: {
  runId: string;
}): Promise<boolean> {
  return cancelAdvisorRun(runId);
}

export async function createConversationHandler({
  title,
}: {
  title?: string;
} = {}): Promise<AiConversationEntity> {
  return createConversation(title);
}

export async function listConversationsHandler(): Promise<
  AiConversationEntity[]
> {
  return listConversations();
}

export async function deleteConversationHandler({
  id,
}: {
  id: string;
}): Promise<void> {
  return deleteConversation(id);
}

export async function listMessagesHandler({
  conversationId,
}: {
  conversationId: string;
}): Promise<AiMessageEntity[]> {
  return listConversationMessages(conversationId);
}

export async function listMemoryHandler({
  status,
}: {
  status?: AiMemoryFactStatus;
} = {}): Promise<AiMemoryFactEntity[]> {
  return listMemoryFacts(status);
}

export async function createMemoryHandler(params: {
  kind: string;
  value: unknown;
  originalText?: string | null;
  sensitivity?: 'normal' | 'sensitive';
}): Promise<AiMemoryFactEntity> {
  return createMemoryCandidate({ ...params, source: 'user' });
}

export async function deleteMemoryHandler({
  id,
}: {
  id: string;
}): Promise<void> {
  return deleteMemoryFact(id);
}

export async function listGoalsHandler(): Promise<AiGoalEntity[]> {
  return listGoals();
}

export async function deleteGoalHandler({ id }: { id: string }): Promise<void> {
  return deleteGoal(id);
}

export async function listDocumentsHandler(): Promise<AiDocumentEntity[]> {
  return listDocuments();
}

export async function deleteDocumentHandler({
  id,
}: {
  id: string;
}): Promise<void> {
  return deleteDocument(id);
}

export async function listAdviceHandler(): Promise<AiAdviceRecordEntity[]> {
  return listAdviceRecords();
}

export async function deleteAdviceHandler({
  id,
}: {
  id: string;
}): Promise<void> {
  return deleteAdviceRecord(id);
}
