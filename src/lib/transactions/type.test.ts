import { describe, expect, it } from 'vitest';
import { effectiveTxnType } from './type';

describe('effectiveTxnType', () => {
  it('falls back to the category default when there is no override', () => {
    expect(effectiveTxnType({ txn_type_override: null }, { txn_type: 'expense' })).toBe('expense');
  });

  it('the override wins over the category default', () => {
    expect(effectiveTxnType({ txn_type_override: 'income' }, { txn_type: 'expense' })).toBe('income');
  });

  it('the override wins even when both are already the same value', () => {
    expect(effectiveTxnType({ txn_type_override: 'transfer' }, { txn_type: 'transfer' })).toBe('transfer');
  });

  it('any of the four types can override any other', () => {
    expect(effectiveTxnType({ txn_type_override: 'investment' }, { txn_type: 'transfer' })).toBe('investment');
  });
});
