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

export type AiRuleMetaStatus = 'proposed' | 'approved' | 'rejected';

export type AiRuleMetaEntity = {
  id: string;
  ruleId: string | null;
  payeeName: string;
  op: 'contains' | 'matches' | 'oneOf';
  value: string;
  categoryId: string;
  rationale: string;
  sampleTransactionIds: string[];
  status: AiRuleMetaStatus;
  hits: number;
  confirmed: number;
  corrected: number;
  runId?: string | null;
  createdAt: number;
  tombstone?: boolean;
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
