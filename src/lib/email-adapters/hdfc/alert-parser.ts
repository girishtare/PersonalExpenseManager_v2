const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/** "14-07-26" (DD-MM-YY) -> "2026-07-14". HDFC alerts always use a 2-digit year in this century. */
function parseShortDate(s: string): string {
  const [day, month, year] = s.split('-');
  return `20${year}-${month}-${day}`;
}

/** "11 Jul, 2026" or "11 Jul 2026" -> "2026-07-11". */
function parseLongDate(s: string): string {
  const match = s.match(/(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})/);
  if (!match) throw new Error(`Unrecognized date format: ${s}`);
  const [, day, monAbbr, year] = match;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (!month) throw new Error(`Unrecognized month: ${monAbbr}`);
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

function parseAmount(s: string): number {
  return Number(s.replace(/,/g, ''));
}

export interface ParsedAlert {
  txnDate: string;
  amount: number;
  direction: 'debit' | 'credit';
  last4: string;
  descriptionRaw: string;
  referenceNo?: string;
}

// \s+ (not literal spaces) between every word - the real email body can hard-wrap at any point,
// and a literal space won't match a newline.
const UPI_DEBIT_RE =
  /Rs\.?\s*([\d,]+\.\d{2})\s+is\s+debited\s+from\s+your\s+account\s+ending\s+(\d{4})\s+towards\s+(?:VPA\s+)?\S+\s*\(([^)]+)\)\s+on\s+(\d{2}-\d{2}-\d{2})/i;

const UPI_CREDIT_RE =
  /Rs\.?\s*([\d,]+\.\d{2})\s+is\s+credited\s+to\s+your\s+account\s+ending\s+(\d{4})\s+(?:from|towards)\s+(?:VPA\s+)?\S+\s*\(([^)]+)\)\s+on\s+(\d{2}-\d{2}-\d{2})/i;

const UPI_REF_RE = /UPI\s+transaction\s+reference\s+no\.?:?\s*(\d+)/i;

const CARD_DEBIT_RE =
  /Rs\.?\s*([\d,]+\.\d{2})\s+has\s+been\s+debited\s+from\s+your\s+HDFC\s+Bank\s+Credit\s+Card\s+ending\s+(\d{4})\s+towards\s+([\s\S]+?)\s+on\s+(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})/i;

// Older template (seen from alerts@hdfcbank.net, the pre-migration sender address) - same
// transactions, different wording. No parentheses around the merchant, and "is debited"/
// "has been debited" are swapped between the UPI and card variants versus the current template.
const OLD_UPI_DEBIT_RE =
  /Rs\.?\s*([\d,]+\.\d{2})\s+has\s+been\s+debited\s+from\s+account\s+(\d{4})\s+to\s+VPA\s+\S+\s+([\s\S]+?)\s+on\s+(\d{2}-\d{2}-\d{2})/i;

const OLD_UPI_REF_RE = /UPI\s+transaction\s+reference\s+number\s+is\s+(\d+)/i;

const OLD_CARD_DEBIT_RE =
  /Rs\.?\s*([\d,]+\.\d{2})\s+is\s+debited\s+from\s+your\s+HDFC\s+Bank\s+Credit\s+Card\s+ending\s+(\d{4})\s+towards\s+([\s\S]+?)\s+on\s+(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})/i;

/**
 * Recognizes the small set of HDFC InstaAlert email templates that represent a completed
 * transaction. Anything else (balance updates, standing-instruction notices, unrecognized
 * formats) returns null and is skipped by the caller - never guessed at, since a wrong parse
 * would corrupt real transaction data. Expect this to need more templates added over time as
 * new alert types are seen in practice (UPI credit, NEFT/IMPS, ATM withdrawal, salary credit).
 */
export function parseHdfcAlertEmail(bodyText: string): ParsedAlert | null {
  const upiDebit = bodyText.match(UPI_DEBIT_RE);
  if (upiDebit) {
    const [, amountStr, last4, merchant, dateStr] = upiDebit;
    const ref = bodyText.match(UPI_REF_RE);
    return {
      txnDate: parseShortDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'debit',
      last4,
      descriptionRaw: `UPI - ${merchant.trim()}`,
      referenceNo: ref?.[1],
    };
  }

  const upiCredit = bodyText.match(UPI_CREDIT_RE);
  if (upiCredit) {
    const [, amountStr, last4, merchant, dateStr] = upiCredit;
    const ref = bodyText.match(UPI_REF_RE);
    return {
      txnDate: parseShortDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'credit',
      last4,
      descriptionRaw: `UPI - ${merchant.trim()}`,
      referenceNo: ref?.[1],
    };
  }

  const cardDebit = bodyText.match(CARD_DEBIT_RE) ?? bodyText.match(OLD_CARD_DEBIT_RE);
  if (cardDebit) {
    const [, amountStr, last4, merchant, dateStr] = cardDebit;
    return {
      txnDate: parseLongDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'debit',
      last4,
      descriptionRaw: `Card - ${merchant.trim()}`,
    };
  }

  const oldUpiDebit = bodyText.match(OLD_UPI_DEBIT_RE);
  if (oldUpiDebit) {
    const [, amountStr, last4, merchant, dateStr] = oldUpiDebit;
    const ref = bodyText.match(OLD_UPI_REF_RE);
    return {
      txnDate: parseShortDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'debit',
      last4,
      descriptionRaw: `UPI - ${merchant.trim()}`,
      referenceNo: ref?.[1],
    };
  }

  return null;
}
