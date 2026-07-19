import type { ParsedAlert } from '../types';

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

// Jupiter's "payment successful" emails render as a stripped-out HTML table - each field is a
// separate label-then-value pair on its own line rather than "Label: Value" on one line like
// HDFC/Saraswat, so each field gets its own targeted regex instead of one big pattern.
const SUCCESS_MARKER_RE = /payment\s+was\s+successful/i;
const PAID_TO_RE = /Paid\s+to\s+([\s\S]+?)\s+[\w.+-]+@[\w.-]+/i;
const AMOUNT_RE = /How\s+much\s+₹\s*([\d,]+(?:\.\d+)?)/i;
const WHEN_RE = /When\s+\w{3},?\s+(\w{3})\s+(\d{1,2}),\s+(\d{4})/i;
// Jupiter alerts never state an "account ending X" - the closest thing to a stable per-account
// identifier is the user's own UPI handle, which is always their registered mobile number
// (e.g. "9820962873@jupiteraxis"). Its last 4 digits stand in for last4, the same role a card or
// account's real last4 plays for other banks.
const PAID_BY_RE = /Paid\s+by\s+[\s\S]+?(\d{4,})@[\w.-]+/i;
const TXN_ID_RE = /Transaction\s+ID\s+(\d+)/i;

/**
 * Recognizes Jupiter's ("jupiter.money") UPI "payment successful" alert emails. Only the debit
 * (money sent) direction has been observed in practice - no "money received" template has been
 * seen yet, so credits aren't handled here rather than guessing at an unverified format.
 */
export function parseJupiterAlertEmail(bodyText: string): ParsedAlert | null {
  if (!SUCCESS_MARKER_RE.test(bodyText)) return null;

  const paidTo = bodyText.match(PAID_TO_RE);
  const amount = bodyText.match(AMOUNT_RE);
  const when = bodyText.match(WHEN_RE);
  const paidBy = bodyText.match(PAID_BY_RE);
  if (!paidTo || !amount || !when || !paidBy) return null;

  const [, monAbbr, day, year] = when;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (!month) return null;

  const txnId = bodyText.match(TXN_ID_RE);

  return {
    txnDate: `${year}-${month}-${day.padStart(2, '0')}`,
    amount: Number(amount[1].replace(/,/g, '')),
    direction: 'debit',
    last4: paidBy[1].slice(-4),
    descriptionRaw: `UPI - ${paidTo[1].trim()}`,
    referenceNo: txnId?.[1],
  };
}
