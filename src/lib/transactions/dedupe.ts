import { createHash } from 'crypto';
import type { TxnDirection } from '../bank-adapters/types';

/**
 * Must exactly match the formula documented in supabase/migrations/..._init_schema.sql
 * (dedupe_hash column comment) - re-uploading a statement with overlapping dates relies on
 * this being deterministic so `INSERT ... ON CONFLICT (account_id, dedupe_hash) DO NOTHING`
 * silently skips already-imported rows.
 */
export function computeDedupeHash(params: {
  accountId: string;
  txnDate: string;
  amount: number;
  direction: TxnDirection;
  descriptionRaw: string;
  referenceNo?: string;
}): string {
  const descriptionNormalized = params.descriptionRaw.trim().toLowerCase();
  const parts = [
    params.accountId,
    params.txnDate,
    // Fixed 2dp to match the numeric(14,2) column - avoids float formatting mismatches (e.g. "100" vs "100.00").
    params.amount.toFixed(2),
    params.direction,
    descriptionNormalized,
    params.referenceNo ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
