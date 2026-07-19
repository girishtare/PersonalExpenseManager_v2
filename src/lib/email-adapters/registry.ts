import { parseHdfcAlertEmail } from './hdfc/alert-parser';
import { parseSaraswatAlertEmail } from './saraswat/alert-parser';
import type { EmailAdapter, ParsedAlert } from './types';

/**
 * Pluggable per-bank alert parsers, mirroring src/lib/bank-adapters/registry.ts's pattern for
 * statement parsing. Adding a new bank's email support means one new adapter file plus one new
 * entry here - nothing else in the sync pipeline needs to change.
 */
const ADAPTERS: EmailAdapter[] = [
  { bankCode: 'HDFC', senders: ['alerts@hdfcbank.bank.in', 'alerts@hdfcbank.net'], parse: parseHdfcAlertEmail },
  { bankCode: 'SARASWAT', senders: ['alert@saraswatbank.co.in'], parse: parseSaraswatAlertEmail },
];

/** Every sender address across every registered adapter - used to build the Gmail search query. */
export function allEmailAlertSenders(): string[] {
  return ADAPTERS.flatMap((adapter) => adapter.senders);
}

/**
 * Tries each registered adapter's parser in turn and tags the result with which bank matched -
 * the caller needs bankCode to resolve the right account (last4 alone isn't unique across banks).
 */
export function parseAlertEmail(bodyText: string): (ParsedAlert & { bankCode: string }) | null {
  for (const adapter of ADAPTERS) {
    const parsed = adapter.parse(bodyText);
    if (parsed) return { ...parsed, bankCode: adapter.bankCode };
  }
  return null;
}
