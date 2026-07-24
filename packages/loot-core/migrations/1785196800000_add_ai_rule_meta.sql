BEGIN TRANSACTION;

CREATE TABLE ai_rule_meta
  (id TEXT PRIMARY KEY,
   rule_id TEXT,
   payee_name TEXT,
   op TEXT,
   value TEXT,
   category_id TEXT,
   rationale TEXT,
   sample_transaction_ids TEXT,
   status TEXT,
   hits INTEGER DEFAULT 0,
   confirmed INTEGER DEFAULT 0,
   corrected INTEGER DEFAULT 0,
   run_id TEXT,
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_rule_meta_rule ON ai_rule_meta(rule_id);
CREATE INDEX ai_rule_meta_status ON ai_rule_meta(status);

COMMIT;
