export type StatementStatus = 'open' | 'closed' | 'paid';

export type StatementEntity = {
  id: string;
  acct: string;
  /** Inclusive period start as yyyy-MM-dd */
  start_date: string;
  /** Inclusive period end (closing date) as yyyy-MM-dd */
  end_date: string;
  /** Payment due date as yyyy-MM-dd */
  due_date: string;
  /** Budget month as YYYYMM the statement hits under the payment regime */
  budget_month: number;
  /** Transaction id of the linked payment; null while unpaid */
  paid_transaction: string | null;
  tombstone: 0 | 1;
  /** Set when this statement reflects a real Pluggy Open Finance bill
   * rather than being purely derived from closing_day/due_day */
  pluggy_bill_id: string | null;
};

/** StatementEntity plus fields derived at query time (never stored). */
export type StatementWithDerived = StatementEntity & {
  status: StatementStatus;
  /** Sum of the card transactions inside the statement period */
  balance: number;
};
