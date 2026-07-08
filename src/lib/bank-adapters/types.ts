export type BankCode = 'HDFC';

export type StatementSourceFormat = 'csv' | 'xlsx' | 'pdf';

export type AccountType = 'savings' | 'current' | 'credit_card';

export type TxnDirection = 'debit' | 'credit';

export interface AccountContext {
  accountId: string;
  bankCode: BankCode;
  accountType: AccountType;
}

export interface RawParsedTransaction {
  /** ISO date, e.g. '2026-03-15' */
  txnDate: string;
  valueDate?: string;
  descriptionRaw: string;
  /** Always positive; sign is carried by `direction`. */
  amount: number;
  direction: TxnDirection;
  referenceNo?: string;
  balanceAfter?: number;
}

export interface ParsedStatement {
  periodStart: string | null;
  periodEnd: string | null;
  transactions: RawParsedTransaction[];
  /** Rows that couldn't be confidently parsed - surfaced to the user, never silently dropped. */
  warnings: string[];
  /**
   * Credit card statement's own printed "Total Amount Due" - includes any carried-over balance
   * from prior statements, so it is NOT directly comparable to sum(transactions) for this
   * statement alone (see opening_balance). Undefined when not applicable/not found - not every
   * format captures this.
   */
  totalAmountDue?: number;
  /** Balance carried in from the previous statement. Undefined when not found. */
  openingBalance?: number;
}

export interface BankStatementParser {
  bankCode: BankCode;
  supportedFormats: StatementSourceFormat[];
  parseCSV?(fileContent: Buffer, ctx: AccountContext): Promise<ParsedStatement>;
  parseExcel?(fileContent: Buffer, ctx: AccountContext): Promise<ParsedStatement>;
  parsePDF?(
    fileContent: Buffer,
    password: string | undefined,
    ctx: AccountContext
  ): Promise<ParsedStatement>;
}
