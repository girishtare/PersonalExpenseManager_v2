/**
 * The set of banks/cards with an account-creation option in the UI. Not every bank here has an
 * email-alert parser yet (e.g. SBI has no alert emails to parse against) - this list only
 * controls what a user can select as an account's issuing bank, independent of ingestion support.
 */
export const BANK_CODES = [
  'HDFC',
  'SARASWAT',
  'JUPITER',
  'SBI',
  'BOBCARD',
  'RBL',
  'SBM',
  'UNI',
  'FEDERAL',
  'FI',
] as const;

export type BankCode = (typeof BANK_CODES)[number];

export const BANK_LABELS: Record<BankCode, string> = {
  HDFC: 'HDFC Bank',
  SARASWAT: 'Saraswat Bank',
  JUPITER: 'Jupiter',
  SBI: 'State Bank of India',
  BOBCARD: 'BOBCARD (One Credit Card)',
  RBL: 'RBL Bank',
  SBM: 'SBM Bank India',
  UNI: 'Uni Cards (discontinued)',
  FEDERAL: 'Federal Bank',
  FI: 'Fi Money (Federal Bank)',
};
