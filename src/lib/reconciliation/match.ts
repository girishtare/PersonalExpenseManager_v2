const TOLERANCE = 1;

export interface BillPayment {
  id: string;
  txn_date: string;
  amount: number;
  description_raw: string;
}

export interface CardStatement {
  id: string;
  file_name: string;
  statement_period_start: string | null;
  statement_period_end: string | null;
  total_amount_due: number | null;
}

export interface MatchedPair {
  payment: BillPayment;
  statement: CardStatement;
  /** payment.amount - statement.total_amount_due (signed - positive means the payment was larger). */
  amountDiff: number;
}

export interface ReconciliationResult {
  matched: MatchedPair[];
  /** CC Bill Payment transactions with no eligible statement (none within tolerance/before the payment date). */
  unmatchedPayments: BillPayment[];
  /** Card statements with a usable total_amount_due, but no bill payment claimed them. */
  unmatchedStatements: CardStatement[];
  /** Card statements missing total_amount_due or period_end - can't be matched either way. */
  unverifiableStatements: CardStatement[];
}

/**
 * Matches each bank-side "CC Bill Payment" transaction to the credit card statement it most
 * likely paid off: the statement's own total_amount_due within +/-Rs.1 of the payment amount,
 * with the statement's period ending before the payment date (you pay after the bill is
 * generated, not before). One statement can only be claimed by one payment.
 *
 * Deliberately matches against total_amount_due rather than an independently recomputed sum of
 * that statement's own transactions - the latter includes prior payment-received line items and
 * excludes the carried-over balance, so it doesn't represent "what was actually paid".
 */
export function reconcileCcBillPayments(payments: BillPayment[], statements: CardStatement[]): ReconciliationResult {
  const verifiable = statements.filter(
    (s): s is CardStatement & { total_amount_due: number; statement_period_end: string } =>
      s.total_amount_due !== null && s.statement_period_end !== null
  );
  const unverifiableStatements = statements.filter((s) => s.total_amount_due === null || s.statement_period_end === null);

  const remainingStatementIds = new Set(verifiable.map((s) => s.id));
  const matched: MatchedPair[] = [];
  const unmatchedPayments: BillPayment[] = [];

  // Oldest payment first, so an early payment doesn't "steal" a statement that a later payment
  // (closer in time) would otherwise have claimed, when both happen to be within tolerance.
  const sortedPayments = [...payments].sort((a, b) => a.txn_date.localeCompare(b.txn_date));

  for (const payment of sortedPayments) {
    const candidates = verifiable.filter(
      (s) =>
        remainingStatementIds.has(s.id) &&
        s.statement_period_end < payment.txn_date &&
        Math.abs(s.total_amount_due - payment.amount) <= TOLERANCE
    );

    if (candidates.length === 0) {
      unmatchedPayments.push(payment);
      continue;
    }

    // Best match: smallest amount difference; tie-break by the most recent period_end (the
    // statement closest in time to the payment).
    candidates.sort((a, b) => {
      const diffA = Math.abs(a.total_amount_due - payment.amount);
      const diffB = Math.abs(b.total_amount_due - payment.amount);
      if (diffA !== diffB) return diffA - diffB;
      return b.statement_period_end.localeCompare(a.statement_period_end);
    });

    const best = candidates[0];
    remainingStatementIds.delete(best.id);
    matched.push({ payment, statement: best, amountDiff: payment.amount - best.total_amount_due });
  }

  const unmatchedStatements = verifiable.filter((s) => remainingStatementIds.has(s.id));

  return { matched, unmatchedPayments, unmatchedStatements, unverifiableStatements };
}

export interface StatementActivity {
  id: string;
  file_name: string;
  total_amount_due: number | null;
  opening_balance: number | null;
  /** Net signed sum of this statement's own parsed transactions (debit positive, credit negative). */
  sumOfTransactions: number;
}

export interface StatementTotalFlag {
  statement: StatementActivity;
  expected: number;
  actual: number;
  diff: number;
}

export interface StatementTotalCheckResult {
  flagged: StatementTotalFlag[];
  /** Statements missing total_amount_due or opening_balance - can't be checked either way. */
  notVerifiable: StatementActivity[];
}

/**
 * Flags statements where the parsed transactions don't add up to the statement's own printed
 * total - a data-quality signal that the parser missed or misparsed a line item. Total Amount
 * Due includes the carried-over balance from prior statements, so the correct comparison is
 * openingBalance + sum(transactions) ~= totalAmountDue, not sum(transactions) ~= totalAmountDue
 * directly (which would mismatch by the opening balance on every statement).
 */
export function findStatementTotalMismatches(statements: StatementActivity[], tolerance = TOLERANCE): StatementTotalCheckResult {
  const flagged: StatementTotalFlag[] = [];
  const notVerifiable: StatementActivity[] = [];

  for (const statement of statements) {
    if (statement.total_amount_due === null || statement.opening_balance === null) {
      notVerifiable.push(statement);
      continue;
    }
    const expected = statement.total_amount_due - statement.opening_balance;
    const diff = statement.sumOfTransactions - expected;
    if (Math.abs(diff) > tolerance) {
      flagged.push({ statement, expected, actual: statement.sumOfTransactions, diff });
    }
  }

  return { flagged, notVerifiable };
}
