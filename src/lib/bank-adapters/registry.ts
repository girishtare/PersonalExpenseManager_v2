import { hdfcParser } from './hdfc/parser';
import type { BankCode, BankStatementParser } from './types';

const registry: Record<BankCode, BankStatementParser> = {
  HDFC: hdfcParser,
};

export function getBankAdapter(bankCode: BankCode): BankStatementParser {
  const adapter = registry[bankCode];
  if (!adapter) {
    throw new Error(`No statement parser registered for bank code "${bankCode}"`);
  }
  return adapter;
}
