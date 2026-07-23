BEGIN TRANSACTION;

ALTER TABLE transactions ADD COLUMN pluggy_bill_id TEXT;
ALTER TABLE statements ADD COLUMN pluggy_bill_id TEXT;

CREATE INDEX transactions_pluggy_bill_id ON transactions(pluggy_bill_id);
CREATE INDEX statements_pluggy_bill_id ON statements(pluggy_bill_id);

COMMIT;
