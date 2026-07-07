/**
 * Reduces a raw bank narration to a "core" string for similarity matching: strips digits
 * (reference numbers, dates, masked card/account suffixes) and punctuation, so two rows for
 * the same recurring merchant/counterparty collapse to the same key even though their exact
 * narration differs transaction to transaction.
 */
export function reduceDescription(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
