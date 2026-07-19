import type { ParsedAlert } from '../types';

/** "30-06-2026" (DD-MM-YYYY) -> "2026-06-30". Saraswat alerts always use a 4-digit year. */
function parseDate(s: string): string {
  const [day, month, year] = s.split('-');
  return `${year}-${month}-${day}`;
}

function parseAmount(s: string): number {
  return Number(s.replace(/,/g, ''));
}

/** Strips the "- " some Particulars values are prefixed with. */
function cleanParticulars(s: string): string {
  return s.replace(/^-\s*/, '').trim();
}

// \s+ (not literal spaces) between words, and the Particulars value captured non-greedily up to
// a known following anchor phrase - same defensive approach as the HDFC parser, since these
// templated emails still hard-wrap in the raw source.

// "Below is a summary of Credit Transaction: Date, Time : 30-06-2026 04:39:02
// Credit Account No: XX1687 Amount: INR 1,000.00 Particulars: - NEFT/HDFCN52026070165489372/GI
// We advise that you keep this email..."
const CREDIT_RE =
  /summary\s+of\s+Credit\s+Transaction:?\s+Date,?\s*Time\s*:\s*(\d{2}-\d{2}-\d{4})\s+\d{2}:\d{2}:\d{2}\s+Credit\s+Account\s+No:?\s*(?:XX)?(\d{4})\s+Amount:?\s*INR\s*([\d,]+\.\d{2})\s+Particulars:?\s*([\s\S]+?)\s+We\s+advise/i;

// Generic "Debit Transaction" summary (e.g. card AMC fees, standing charges) - same shape as
// Credit above but for debits.
const DEBIT_RE =
  /summary\s+of\s+Debit\s+Transaction:?\s+Date,?\s*Time\s*:\s*(\d{2}-\d{2}-\d{4})\s+\d{2}:\d{2}:\d{2}\s+Debit\s+Account\s+No:?\s*(?:XX)?(\d{4})\s+Amount:?\s*INR\s*([\d,]+\.\d{2})\s+Particulars:?\s*([\s\S]+?)\s+We\s+advise/i;

// A separate wording specifically for NEFT/RTGS debits, with its own Ref no field and a
// different closing sentence than the two templates above.
const NEFT_RTGS_DEBIT_RE =
  /summary\s+of\s+NEFT\/RTGS\s+debit\s+transaction\s+from\s+your\s+account:?\s+Date,?\s*Time\s*:\s*(\d{2}-\d{2}-\d{4})\s+\d{2}:\d{2}:\d{2}\s+Debit\s+Account\s+no:?\s*(?:XX)?(\d{4})\s+Amount:?\s*INR\s*([\d,]+\.\d{2})\s+Ref\s+no:?\s*(\S+)\s+Particulars:?\s*([\s\S]+?)\s+You\s+will\s+get/i;

/**
 * Recognizes Saraswat Co-op Bank's "Saraswat Bank Alert" emails (sender alert@saraswatbank.co.in).
 * Same never-guess philosophy as the HDFC parser: anything unrecognized (statements, KYC
 * reminders, etc.) returns null rather than being guessed at.
 */
export function parseSaraswatAlertEmail(bodyText: string): ParsedAlert | null {
  const neftRtgs = bodyText.match(NEFT_RTGS_DEBIT_RE);
  if (neftRtgs) {
    const [, dateStr, last4, amountStr, refNo, particulars] = neftRtgs;
    return {
      txnDate: parseDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'debit',
      last4,
      descriptionRaw: cleanParticulars(particulars),
      referenceNo: refNo,
    };
  }

  const debit = bodyText.match(DEBIT_RE);
  if (debit) {
    const [, dateStr, last4, amountStr, particulars] = debit;
    return {
      txnDate: parseDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'debit',
      last4,
      descriptionRaw: cleanParticulars(particulars),
    };
  }

  const credit = bodyText.match(CREDIT_RE);
  if (credit) {
    const [, dateStr, last4, amountStr, particulars] = credit;
    return {
      txnDate: parseDate(dateStr),
      amount: parseAmount(amountStr),
      direction: 'credit',
      last4,
      descriptionRaw: cleanParticulars(particulars),
    };
  }

  return null;
}
