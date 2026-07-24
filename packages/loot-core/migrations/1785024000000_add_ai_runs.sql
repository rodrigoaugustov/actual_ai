BEGIN TRANSACTION;

CREATE TABLE ai_runs
  (id TEXT PRIMARY KEY,
   agent TEXT,
   tier TEXT,
   provider TEXT,
   model TEXT,
   input_tokens INTEGER,
   output_tokens INTEGER,
   cache_read_tokens INTEGER,
   cache_write_tokens INTEGER,
   cost_usd REAL,
   duration_ms INTEGER,
   status TEXT,
   error TEXT,
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_runs_created_at ON ai_runs(created_at);

COMMIT;
