export type AiTier = 'fast' | 'standard' | 'frontier';
export type AiProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'ollama';

export type AiTierConfig = {
  provider: AiProviderId;
  model: string;
};

export type AiConfig = {
  enabled: boolean;
  tiers: Record<AiTier, AiTierConfig>;
  /** Auto-apply a classifier suggestion at/above this confidence; below it
   * the suggestion is left as a pending item in the review inbox. */
  confidenceThreshold: number;
  redactPii: boolean;
  /** Sensitive confirmed profile memories stay local unless the user
   * explicitly opts in to include them in advisor prompts. */
  shareSensitiveMemoryWithProvider?: boolean;
  maxCostPerRunUsd?: number;
  maxCostPerDayUsd?: number;
};

export type AiSuggestionStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'auto_applied';

export type AiSuggestionEntity = {
  id: string;
  transactionId: string;
  categoryId: string | null;
  confidence: number;
  rationale: string;
  status: AiSuggestionStatus;
  runId?: string | null;
  createdAt: number;
  tombstone?: boolean;
};

/** AiSuggestionEntity plus the transaction fields the review inbox needs to
 * display — a read model, not a stored shape. Mirrors the columns the
 * uncategorized register shows (account, payee, notes) so the two screens
 * read the same. */
export type AiSuggestionForReview = AiSuggestionEntity & {
  accountName: string | null;
  payeeName: string | null;
  notes: string | null;
  amount: number;
  date: string;
};

/** One entry per transaction with a non-rejected suggestion — the minimal
 * shape the register needs to show which transactions AI has touched,
 * without pulling in the full suggestion (rationale, run id, etc). */
export type AiSuggestionIndexEntry = {
  id: string;
  transactionId: string;
  categoryId: string | null;
  status: AiSuggestionStatus;
};

export type AiFeedbackSource =
  | 'manual'
  | 'accepted'
  | 'corrected'
  | 'rejected'
  | 'auto_applied_overridden';

export type AiFeedbackEntity = {
  id: string;
  transactionId: string;
  accountId: string;
  payeeName: string;
  normalizedPayee: string;
  amount: number;
  suggestedCategoryId: string | null;
  finalCategoryId: string | null;
  source: AiFeedbackSource;
  suggestionId: string | null;
  runId: string | null;
  createdAt: number;
};

export type AiRuleMetaStatus = 'proposed' | 'approved' | 'rejected';

export type AiRuleSampleTransaction = {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  importedPayee: string | null;
  accountName: string | null;
};

export type AiRuleMetaEntity = {
  id: string;
  ruleId: string | null;
  payeeName: string;
  op: 'contains' | 'matches' | 'oneOf';
  value: string;
  categoryId: string;
  rationale: string;
  sampleTransactionIds: string[];
  sampleTransactions?: AiRuleSampleTransaction[];
  status: AiRuleMetaStatus;
  hits: number;
  confirmed: number;
  corrected: number;
  runId?: string | null;
  createdAt: number;
  tombstone?: boolean;
  recentFalsePositives?: Array<{
    transactionId: string;
    payeeName: string | null;
    rationale: string | null;
    auditedAt: number | null;
  }>;
};

export type ClassifyOutcome =
  | { status: 'disabled' }
  | { status: 'budget-exceeded' }
  | { status: 'no-pending' }
  | { status: 'run-failed' }
  | { status: 'ok'; autoApplied: number; pendingReview: number };

export type MineRulesOutcome =
  | { status: 'disabled' }
  | { status: 'budget-exceeded' }
  | { status: 'no-candidates' }
  | { status: 'run-failed' }
  | { status: 'ok'; proposalsCreated: number };

export type AuditRulesOutcome =
  | { status: 'disabled' }
  | { status: 'budget-exceeded' }
  | { status: 'no-pending' }
  | {
      status: 'ok';
      audited: number;
      confirmed: number;
      corrected: number;
      skipped: number;
      failed: number;
    };

export type AiConversationStatus = 'active' | 'archived';

export type AiConversationEntity = {
  id: string;
  title: string;
  status: AiConversationStatus;
  summary: string | null;
  createdAt: number;
  updatedAt: number;
  tombstone?: boolean;
};

export type AiMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type AiTraceKind =
  | 'understanding'
  | 'context'
  | 'planning'
  | 'tool'
  | 'validation'
  | 'retry'
  | 'composing';

export type AiTraceState = 'running' | 'completed' | 'error';

export type AiTraceDetail = {
  dataset?: string;
  periodStart?: string;
  periodEnd?: string;
  fields?: string[];
  dimensions?: string[];
  metrics?: string[];
  filters?: string[];
  sourceRows?: number;
  resultRows?: number;
  returnedRows?: number;
  complete?: boolean;
  hasMore?: boolean;
  count?: number;
  attempt?: number;
  step?: number;
  memoryCount?: number;
  goalCount?: number;
  sourceCount?: number;
};

export type AiTracePart = {
  type: 'trace';
  id: string;
  kind: AiTraceKind;
  state: AiTraceState;
  toolName?: string;
  startedAt: number;
  completedAt?: number;
  detail?: AiTraceDetail;
};

export type AiMessagePart =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      toolName: string;
      state: 'call' | 'result' | 'error';
      input?: unknown;
      output?: unknown;
    }
  | {
      type: 'source';
      sourceType: 'financial' | 'memory' | 'document';
      sourceId: string;
      title: string;
      excerpt?: string;
    }
  | AiTracePart;

export type AiMessageEntity = {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  parts: AiMessagePart[];
  runId: string | null;
  createdAt: number;
  tombstone?: boolean;
};

export type AiMemoryFactStatus =
  | 'candidate'
  | 'confirmed'
  | 'rejected'
  | 'superseded';

export type AiMemoryFactEntity = {
  id: string;
  subject: string;
  kind: string;
  value: unknown;
  originalText: string | null;
  source: 'user' | 'conversation' | 'document' | 'system';
  confidence: number;
  status: AiMemoryFactStatus;
  sensitivity: 'normal' | 'sensitive';
  sourceMessageId: string | null;
  sourceDocumentId: string | null;
  supersedesId: string | null;
  validFrom: number | null;
  validTo: number | null;
  lastConfirmedAt: number | null;
  createdAt: number;
  updatedAt: number;
  tombstone?: boolean;
};

export type AiGoalEntity = {
  id: string;
  title: string;
  description: string;
  targetAmount: number | null;
  targetDate: number | null;
  priority: number;
  flexibility: 'fixed' | 'flexible';
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  progressNote: string | null;
  nextReviewAt: number | null;
  createdAt: number;
  updatedAt: number;
  tombstone?: boolean;
};

export type AiDocumentEntity = {
  id: string;
  title: string;
  kind: string;
  content: string;
  source: 'user' | 'conversation' | 'import';
  createdAt: number;
  updatedAt: number;
  tombstone?: boolean;
};

export type AiAdviceRecordEntity = {
  id: string;
  conversationId: string | null;
  title: string;
  recommendation: string;
  assumptions: string[];
  evidence: AiMessagePart[];
  alternatives: string[];
  risks: string[];
  status: 'proposed' | 'accepted' | 'rejected' | 'completed';
  followUpAt: number | null;
  createdAt: number;
  updatedAt: number;
  tombstone?: boolean;
};

export type AiRunEntity = {
  id: string;
  agent: string;
  tier: AiTier;
  provider: AiProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  status: 'ok' | 'error';
  error?: string | null;
  createdAt: number;
  tombstone?: boolean;
};
