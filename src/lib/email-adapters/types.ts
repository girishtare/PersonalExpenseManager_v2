export interface ParsedAlert {
  txnDate: string;
  amount: number;
  direction: 'debit' | 'credit';
  last4: string;
  descriptionRaw: string;
  referenceNo?: string;
}

export interface EmailAdapter {
  bankCode: string;
  /** Sender addresses this bank's alerts come from - used to build the Gmail search query. */
  senders: string[];
  parse: (bodyText: string) => ParsedAlert | null;
}
