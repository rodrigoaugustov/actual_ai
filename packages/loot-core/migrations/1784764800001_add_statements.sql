BEGIN TRANSACTION;

CREATE TABLE statements
  (id TEXT PRIMARY KEY,
   acct TEXT,
   start_date INTEGER,
   end_date INTEGER,
   due_date INTEGER,
   budget_month INTEGER,
   paid_transaction TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX statements_acct_dates ON statements(acct, start_date, end_date);

COMMIT;
