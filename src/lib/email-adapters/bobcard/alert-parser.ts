import type { ParsedAlert } from '../types';

/** "23/05/2026" (DD/MM/YYYY) -> "2026-05-23". */
function parseDate(s: string): string {
  const [day, month, year] = s.split('/');
  return `${year}-${month}-${day}`;
}

function parseAmount(s: string): number {
  return Number(s.replace(/,/g, ''));
}

// Only matches when the amount is stated in INR - some real alerts show foreign-currency
// (e.g. "Amount: USD 5.90") transactions, and this regex simply won't match those, so they're
// skipped rather than importing a USD figure as if it were rupees.
const CARD_USAGE_RE =
  /BOBCARD\s+One\s+Credit\s+Card\s+ending\s+in\s+(\d{4})\s+was\s+used\s+to\s+make\s+a\s+payment\.?\s+Amount:?\s*INR\s*([\d,]+\.\d{2})\s+Merchant:?\s*([\s\S]+?)\s+Date:?\s*(\d{2}\/\d{2}\/\d{4})/i;

/**
 * Recognizes "One Credit Card" (reissued as "BOBCARD One Credit Card", sender getonecard.app)
 * per-transaction payment alerts. Same never-guess philosophy as the other adapters: statements
 * and marketing mail return null.
 */
export function parseBobcardAlertEmail(bodyText: string): ParsedAlert | null {
  const cardUsage = bodyText.match(CARD_USAGE_RE);
  if (!cardUsage) return null;

  const [, last4, amountStr, merchant, dateStr] = cardUsage;
  return {
    txnDate: parseDate(dateStr),
    amount: parseAmount(amountStr),
    direction: 'debit',
    last4,
    descriptionRaw: `Card - ${merchant.trim()}`,
  };
}
