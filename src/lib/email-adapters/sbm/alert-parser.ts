import type { ParsedAlert } from '../types';

/** "01-07-2026" (DD-MM-YYYY) -> "2026-07-01". */
function parseDate(s: string): string {
  const [day, month, year] = s.split('-');
  return `${year}-${month}-${day}`;
}

function parseAmount(s: string): number {
  return Number(s.replace(/,/g, ''));
}

// Both directions use the same sentence shape, just "credited"/"debited" swapped - e.g.
// "Your account XX2750 is credited with INR 2.00 on 01-07-2026. Info:20051021492750:Int.Pd:
// 01-06-20. The Curr bal is 796.00." / "...is debited with INR 1076.00 on 05-12-2022.
// Info:PG_20051021492750_T4082777_IND. The Curr bal is 41.00." Note: despite the wording, the
// debit variant has been observed under the subject "SBM Bank" rather than a dedicated
// "Debit Transaction Alert" subject, so recognition relies on the body, not the subject.
const TXN_RE =
  /Your\s+account\s+XX(\d{4})\s+is\s+(credited|debited)\s+with\s+INR\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-\d{2}-\d{4})\.\s*Info:?\s*([\s\S]+?)\.\s*The\s+Curr\s+bal/i;

/**
 * Recognizes SBM Bank India's "Credit Transaction Alert" / debit-equivalent emails (sender
 * info@sbmbank.co.in). Same never-guess philosophy as the other adapters: e-statements,
 * downtime notices, and marketing return null.
 */
export function parseSbmAlertEmail(bodyText: string): ParsedAlert | null {
  const match = bodyText.match(TXN_RE);
  if (!match) return null;

  const [, last4, directionWord, amountStr, dateStr, info] = match;
  return {
    txnDate: parseDate(dateStr),
    amount: parseAmount(amountStr),
    direction: directionWord.toLowerCase() === 'credited' ? 'credit' : 'debit',
    last4,
    descriptionRaw: info.trim(),
  };
}
