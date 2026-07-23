BEGIN TRANSACTION;

ALTER TABLE transactions ADD COLUMN installment_group TEXT;
ALTER TABLE transactions ADD COLUMN installment_num INTEGER;
ALTER TABLE transactions ADD COLUMN installment_total INTEGER;

COMMIT;
