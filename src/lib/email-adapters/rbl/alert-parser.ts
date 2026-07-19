import type { ParsedAlert } from '../types';

/** "12-04-2026" (DD-MM-YYYY) -> "2026-04-12". */
function parseDate(s: string): string {
  const [day, month, year] = s.split('-');
  return `${year}-${month}-${day}`;
}

function parseAmount(s: string): number {
  return Number(s.replace(/,/g, ''));
}

// "Card swipe: INR337.48 spent at WIX.COM 1233488769 on RBL Bank credit card (1618) on
// 12-04-2026.AVL limit- INR753,693.16." - only the spend ("card swipe") alert is handled here,
// matching the same convention as the HDFC adapter: "payment received towards your card" alerts
// represent bill payments, which the reconciliation view already covers against statement
// totals rather than tracking each one as its own transaction.
const CARD_SWIPE_RE =
  /INR\s*([\d,]+\.\d{2})\s+spent\s+at\s+([\s\S]+?)\s+on\s+RBL\s+Bank\s+credit\s+card\s+\((\d{4})\)\s+on\s+(\d{2}-\d{2}-\d{4})/i;

/**
 * Recognizes RBL Bank's "Alert: Your RBL Bank Credit Card has just been swiped" per-transaction
 * emails (sender RBLAlerts@rbl.bank.in / alerts.notification.my.rbl.bank.in).
 */
export function parseRblAlertEmail(bodyText: string): ParsedAlert | null {
  const swipe = bodyText.match(CARD_SWIPE_RE);
  if (!swipe) return null;

  const [, amountStr, merchant, last4, dateStr] = swipe;
  return {
    txnDate: parseDate(dateStr),
    amount: parseAmount(amountStr),
    direction: 'debit',
    last4,
    descriptionRaw: `Card - ${merchant.trim()}`,
  };
}
