// Suggests which already-imported transactions most likely represent
// a statement's bill payment, so "Mark paid" can offer a one-click
// confirmation instead of requiring the user to manually find and
// pair the two transactions in the register.
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import type { DbStatement } from '#server/db';
import { batchUpdateTransactions } from '#server/transactions';
import * as monthUtils from '#shared/months';
import { q } from '#shared/query';
import { validForTransfer } from '#shared/transfer';
import type { TransactionEntity } from '#types/models';

export type PaymentSuggestion = {
  cardTransactionId: string | null;
  counterpartTransactionId: string | null;
};

// A payment typically posts a little before the statement closes
// (early payment) through some time after the due date (late
// payment); widen generously since this is only a starting suggestion
// the user can always override.
const SEARCH_BEFORE_DAYS = 10;
const SEARCH_AFTER_DAYS = 20;
const COUNTERPART_DATE_TOLERANCE_DAYS = 10;

function toInt(day: string): number {
  return db.toDateRepr(day);
}

function toDay(dateInt: number): string {
  return db.fromDateRepr(dateInt);
}

/**
 * Suggest the most likely candidates: an unlinked credit on the card
 * account itself, and — if that other account is also tracked in
 * Actual — its unlinked counterpart debit. `targetAmount` (typically
 * the statement's shown balance) steers the card-side match when
 * known; date proximity to the due date is the fallback signal.
 */
export function suggestStatementPayment(
  statement: Pick<DbStatement, 'acct' | 'end_date' | 'due_date'>,
  targetAmount: number,
): PaymentSuggestion {
  const windowStart = toInt(
    monthUtils.subDays(toDay(statement.end_date), SEARCH_BEFORE_DAYS),
  );
  const windowEnd = toInt(
    monthUtils.addDays(toDay(statement.due_date), SEARCH_AFTER_DAYS),
  );
  const absTarget = Math.abs(targetAmount);

  const cardCandidate =
    absTarget > 0
      ? db.firstSync<{ id: string; amount: number; date: number }>(
          `SELECT id, amount, date FROM v_transactions_internal_alive
            WHERE account = ? AND transfer_id IS NULL AND amount > 0
              AND date >= ? AND date <= ?
            ORDER BY ABS(amount - ?) ASC, date DESC
            LIMIT 1`,
          [statement.acct, windowStart, windowEnd, absTarget],
        )
      : db.firstSync<{ id: string; amount: number; date: number }>(
          `SELECT id, amount, date FROM v_transactions_internal_alive
            WHERE account = ? AND transfer_id IS NULL AND amount > 0
              AND date >= ? AND date <= ?
            ORDER BY ABS(date - ?) ASC
            LIMIT 1`,
          [statement.acct, windowStart, windowEnd, statement.due_date],
        );

  if (cardCandidate == null) {
    return { cardTransactionId: null, counterpartTransactionId: null };
  }

  const counterpartWindowStart = toInt(
    monthUtils.subDays(toDay(cardCandidate.date), COUNTERPART_DATE_TOLERANCE_DAYS),
  );
  const counterpartWindowEnd = toInt(
    monthUtils.addDays(toDay(cardCandidate.date), COUNTERPART_DATE_TOLERANCE_DAYS),
  );

  const counterpart = db.firstSync<{ id: string }>(
    `SELECT id FROM v_transactions_internal_alive
      WHERE account != ? AND transfer_id IS NULL AND amount = ?
        AND date >= ? AND date <= ?
      ORDER BY ABS(date - ?) ASC
      LIMIT 1`,
    [
      statement.acct,
      -cardCandidate.amount,
      counterpartWindowStart,
      counterpartWindowEnd,
      cardCandidate.date,
    ],
  );

  return {
    cardTransactionId: cardCandidate.id,
    counterpartTransactionId: counterpart?.id ?? null,
  };
}

/**
 * Pair two already-imported transactions as a real transfer, mirroring
 * the register's "Make transfer" bulk action: swap each transaction's
 * payee to the other account's transfer payee and link `transfer_id`
 * directly (`runTransfers: false`) rather than relying on the
 * insert-time transfer hook, since these already exist.
 */
export async function pairAsTransfer(
  cardTransactionId: string,
  counterpartTransactionId: string,
): Promise<void> {
  const { data: transactions } = await aqlQuery(
    q('transactions')
      .filter({ id: { $oneof: [cardTransactionId, counterpartTransactionId] } })
      .select('*'),
  );
  const cardTrans = (transactions as TransactionEntity[]).find(
    t => t.id === cardTransactionId,
  );
  const counterpartTrans = (transactions as TransactionEntity[]).find(
    t => t.id === counterpartTransactionId,
  );

  if (
    cardTrans == null ||
    counterpartTrans == null ||
    !validForTransfer(cardTrans, counterpartTrans)
  ) {
    throw new Error(
      'Selected transactions are not a valid transfer pair (different accounts, opposite amounts, neither already a transfer)',
    );
  }

  const payees = await db.all<{ id: string; transfer_acct: string }>(
    'SELECT id, transfer_acct FROM payees WHERE transfer_acct IN (?, ?)',
    [cardTrans.account, counterpartTrans.account],
  );
  const cardPayee = payees.find(p => p.transfer_acct === counterpartTrans.account);
  const counterpartPayee = payees.find(p => p.transfer_acct === cardTrans.account);

  // `category: null` is the established wire convention for clearing a
  // transaction's category (see `transfer.ts`'s own `clearCategory`);
  // `TransactionEntity['category']` is typed as `string | undefined`
  // for API consumers, so the local cast below just matches that
  // existing runtime contract without loosening the shared type.
  const clearedCategory = null as unknown as TransactionEntity['category'];

  await batchUpdateTransactions({
    updated: [
      {
        ...cardTrans,
        category: clearedCategory,
        payee: cardPayee?.id,
        transfer_id: counterpartTrans.id,
      },
      {
        ...counterpartTrans,
        category: clearedCategory,
        payee: counterpartPayee?.id,
        transfer_id: cardTrans.id,
      },
    ],
    runTransfers: false,
  });
}
