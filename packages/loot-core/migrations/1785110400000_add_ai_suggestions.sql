BEGIN TRANSACTION;

CREATE TABLE ai_suggestions
  (id TEXT PRIMARY KEY,
   transaction_id TEXT,
   category_id TEXT,
   confidence REAL,
   rationale TEXT,
   status TEXT,
   run_id TEXT,
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_suggestions_transaction ON ai_suggestions(transaction_id);
CREATE INDEX ai_suggestions_status ON ai_suggestions(status);

COMMIT;
