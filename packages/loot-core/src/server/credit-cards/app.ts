import { createApp } from '#server/app';
import * as db from '#server/db';
import type { DbAccount, DbStatement } from '#server/db';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import * as monthUtils from '#shared/months';
import type { StatementWithDerived, TransactionEntity } from '#types/models';

import { createInstallments, deleteInstallments } from './installments';
import { pairAsTransfer, suggestStatementPayment } from './payment-match';
import type { PaymentSuggestion } from './payment-match';
import {
  ensureAllStatements,
  ensureStatements,
  getStatementStatus,
  MANUAL_PAID,
} from './statements';

export type CreditCardHandlers = {
  'credit-card/update-config': typeof updateConfig;
  'credit-card/get-statements': typeof getStatements;
  'credit-card/mark-statement-paid': typeof markStatementPaid;
  'credit-card/unmark-statement-paid': typeof unmarkStatementPaid;
  'credit-card/suggest-statement-payment': typeof suggestStatementPaymentHandler;
  'credit-card/confirm-statement-payment': typeof confirmStatementPaymentHandler;
  'credit-card/create-installments': typeof createInstallmentsHandler;
  'credit-card/delete-installments': typeof deleteInstallmentsHandler;
};

export const app = createApp<CreditCardHandlers>();
app.method('credit-card/update-config', mutator(undoable(updateConfig)));
app.method('credit-card/get-statements', getStatements);
app.method(
  'credit-card/mark-statement-paid',
  mutator(undoable(markStatementPaid)),
);
app.method(
  'credit-card/unmark-statement-paid',
  mutator(undoable(unmarkStatementPaid)),
);
app.method(
  'credit-card/suggest-statement-payment',
  suggestStatementPaymentHandler,
);
app.method(
  'credit-card/confirm-statement-payment',
  mutator(undoable(confirmStatementPaymentHandler)),
);
app.method(
  'credit-card/create-installments',
  mutator(undoable(createInstallmentsHandler)),
);
app.method(
  'credit-card/delete-installments',
  mutator(undoable(deleteInstallmentsHandler)),
);

app.events.on('sync', ({ type }) => {
  // After a successful sync, roll the statement horizon forward for
  // all card accounts (cheap and idempotent)
  if (type === 'success' && db.getDatabase()) {
    void ensureAllStatements();
  }
});

async function updateConfig({
  id,
  closingDay,
  dueDay,
}: {
  id: DbAccount['id'];
  closingDay: number | null;
  dueDay: number | null;
}): Promise<void> {
  if (closingDay != null && (closingDay < 1 || closingDay > 31)) {
    throw new Error('Invalid closing day: ' + closingDay);
  }
  if (dueDay != null && (dueDay < 1 || dueDay > 31)) {
    throw new Error('Invalid due day: ' + dueDay);
  }

  await db.update('accounts', {
    id,
    closing_day: closingDay,
    due_day: dueDay,
  });

  if (closingDay != null && dueDay != null) {
    await ensureStatements(id);
  }
}

export async function getStatements({
  accountId,
}: {
  accountId: DbAccount['id'];
}): Promise<StatementWithDerived[]> {
  // Bill payments land in this same account as a transfer from the
  // paying account; they settle a PAST statement's debt and must not
  // be netted into whichever statement they happen to fall into, or a
  // payment posting inside period N would flip period N's total
  // (purchases only) toward zero or positive. Refunds/cashback
  // (ordinary, non-transfer credits) correctly remain part of the
  // total, since they genuinely reduce what's owed for that period.
  //
  // A transaction with a real Pluggy bill link is only ever counted
  // toward the statement carrying that same link — never toward a
  // different statement its date range happens to overlap — exactly
  // mirroring the priority used for budget bucketing in
  // `budget-queries.ts`'s `paymentJoin`.
  const rows = db.runQuery<DbStatement & { computed_balance: number | null }>(
    `SELECT s.*,
            (SELECT SUM(t.amount) FROM v_transactions_internal_alive t
              WHERE t.account = s.acct
                AND t.transfer_id IS NULL
                AND (
                  (t.pluggy_bill_id IS NOT NULL AND t.pluggy_bill_id = s.pluggy_bill_id)
                  OR (t.pluggy_bill_id IS NULL AND t.date >= s.start_date AND t.date <= s.end_date)
                )
            ) as computed_balance
       FROM statements s
      WHERE s.acct = ? AND s.tombstone = 0
      ORDER BY s.end_date DESC`,
    [accountId],
    true,
  );

  const today = monthUtils.currentDay();
  return rows.map(row => ({
    id: row.id,
    acct: row.acct,
    start_date: db.fromDateRepr(row.start_date),
    end_date: db.fromDateRepr(row.end_date),
    due_date: db.fromDateRepr(row.due_date),
    budget_month: row.budget_month,
    paid_transaction: row.paid_transaction,
    pluggy_bill_id: row.pluggy_bill_id ?? null,
    tombstone: row.tombstone,
    status: getStatementStatus(row, today),
    // The bank's own reported total is authoritative when known — it
    // also reflects finance charges/IOF that may have no transaction
    // of their own; otherwise fall back to summing linked transactions
    balance: row.pluggy_total_amount ?? row.computed_balance ?? 0,
  }));
}

export async function markStatementPaid({
  id,
  transactionId,
}: {
  id: DbStatement['id'];
  /** Payment transaction to link; omit to mark paid manually */
  transactionId?: string | null;
}): Promise<void> {
  await db.update('statements', {
    id,
    paid_transaction: transactionId ?? MANUAL_PAID,
  });
}

async function unmarkStatementPaid({
  id,
}: {
  id: DbStatement['id'];
}): Promise<void> {
  await db.update('statements', { id, paid_transaction: null });
}

async function suggestStatementPaymentHandler({
  statementId,
}: {
  statementId: DbStatement['id'];
}): Promise<PaymentSuggestion> {
  const statement = db.firstSync<DbStatement>(
    'SELECT * FROM statements WHERE id = ?',
    [statementId],
  );
  if (statement == null) {
    return { cardTransactionId: null, counterpartTransactionId: null };
  }

  const statements = await getStatements({ accountId: statement.acct });
  const targetAmount = statements.find(s => s.id === statementId)?.balance ?? 0;

  return suggestStatementPayment(statement, targetAmount);
}

async function confirmStatementPaymentHandler({
  statementId,
  cardTransactionId,
  counterpartTransactionId,
}: {
  statementId: DbStatement['id'];
  cardTransactionId?: string | null;
  counterpartTransactionId?: string | null;
}): Promise<void> {
  if (cardTransactionId != null && counterpartTransactionId != null) {
    await pairAsTransfer(cardTransactionId, counterpartTransactionId);
  }

  await markStatementPaid({
    id: statementId,
    transactionId: cardTransactionId,
  });
}

async function createInstallmentsHandler(params: {
  account: string;
  payee?: string;
  category?: string;
  notes?: string;
  amount: number;
  count: number;
  date: string;
}): Promise<TransactionEntity[]> {
  return createInstallments(params);
}

async function deleteInstallmentsHandler(params: {
  groupId: string;
  fromNum?: number;
}): Promise<string[]> {
  return deleteInstallments(params);
}
