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

// UNI never states a card number anywhere in its emails (checked across statements, sanction
// letters, and transaction alerts) - since only one UNI account will ever exist for this user, a
// fixed placeholder stands in for last4 rather than something derived per-message.
const PLACEHOLDER_LAST4 = '0001';

const AMOUNT_RE = /₹\s*([\d,]+(?:\.\d+)?)\s+Paid\s+to/i;
const MERCHANT_RE = /Paid\s+to\s+([\s\S]+?)\s+Transaction\s+ID/i;
const TXN_ID_RE = /Transaction\s+ID\s+(\S+)/i;
const WHEN_RE = /Transaction\s+on\s+(\d{1,2})\s+(\w{3})\s+(\d{4})/i;

function cleanMerchant(s: string): string {
  return s.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Recognizes Uni Cards' ("Uni Pay 1/3" BNPL card, sender uni.club) per-transaction "You paid ₹X
 * at MERCHANT" alerts. The card was discontinued in December 2022 (confirmed via a real policy-
 * change email from Uni), so this only matters for a one-time historical backfill.
 */
export function parseUniAlertEmail(bodyText: string): ParsedAlert | null {
  const amount = bodyText.match(AMOUNT_RE);
  const merchant = bodyText.match(MERCHANT_RE);
  const when = bodyText.match(WHEN_RE);
  if (!amount || !merchant || !when) return null;

  const [, day, monAbbr, year] = when;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (!month) return null;

  const txnId = bodyText.match(TXN_ID_RE);

  return {
    txnDate: `${year}-${month}-${day.padStart(2, '0')}`,
    amount: Number(amount[1].replace(/,/g, '')),
    direction: 'debit',
    last4: PLACEHOLDER_LAST4,
    descriptionRaw: `Card - ${cleanMerchant(merchant[1])}`,
    referenceNo: txnId?.[1],
  };
}
