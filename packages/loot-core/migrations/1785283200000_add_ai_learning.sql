BEGIN TRANSACTION;

CREATE TABLE ai_feedback
  (id TEXT PRIMARY KEY,
   transaction_id TEXT,
   account_id TEXT,
   payee_name TEXT,
   normalized_payee TEXT,
   amount INTEGER,
   suggested_category_id TEXT,
   final_category_id TEXT,
   source TEXT,
   suggestion_id TEXT,
   run_id TEXT,
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_feedback_transaction ON ai_feedback(transaction_id);
CREATE INDEX ai_feedback_lookup
  ON ai_feedback(account_id, normalized_payee, created_at);
CREATE INDEX ai_feedback_created_at ON ai_feedback(created_at);

CREATE TABLE ai_rule_hits
  (id TEXT PRIMARY KEY,
   rule_meta_id TEXT,
   rule_id TEXT,
   transaction_id TEXT,
   category_id TEXT,
   status TEXT DEFAULT 'pending',
   rationale TEXT,
   audited_at INTEGER,
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE UNIQUE INDEX ai_rule_hits_unique
  ON ai_rule_hits(rule_meta_id, transaction_id);
CREATE INDEX ai_rule_hits_status ON ai_rule_hits(status);

COMMIT;
