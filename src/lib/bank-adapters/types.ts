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
