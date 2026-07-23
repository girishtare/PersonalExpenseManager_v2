import { describe, expect, it } from 'vitest';
import { detectRecurringDebits, type RecurrenceTxn } from './recurrence';

const ASOF = new Date(2026, 6, 8); // 2026-07-08

function txn(
  txn_date: string,
  amount: number,
  description_raw: string,
  direction: 'debit' | 'credit' = 'debit',
  categoryName?: string
): RecurrenceTxn {
  return { txn_date, amount, description_raw, direction, categoryName };
}

describe('detectRecurringDebits', () => {
  it('detects a clean monthly EMI pattern and predicts the next occurrence', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-04-16', 7912, 'OFFUS EMI PRIN NB 05 0000128341922 (Ref# 09999999980416008531795)'),
        txn('2026-05-16', 7912, 'OFFUS EMI PRIN NB 05 0000128341922 (Ref# 09999999980516008531795)'),
        txn('2026-06-16', 7912, 'OFFUS EMI PRIN NB 05 0000128341922 (Ref# 09999999980616008531795)'),
      ],
      ASOF
    );
    expect(result).toHaveLength(1);
    expect(result[0].expectedDate).toBe('2026-07-16');
    expect(result[0].expectedAmount).toBe(7912);
    expect(result[0].occurrences).toBe(3);
  });

  it('rejects a group whose amounts vary by more than 5%', () => {
    const result = detectRecurringDebits(
      [txn('2026-04-16', 1000, 'SIP MUTUAL FUND XYZ123'), txn('2026-05-16', 1000, 'SIP MUTUAL FUND XYZ124'), txn('2026-06-16', 1300, 'SIP MUTUAL FUND XYZ125')],
      ASOF
    );
    expect(result).toHaveLength(0);
  });

  it('accepts small amount variation within 5%', () => {
    const result = detectRecurringDebits(
      [txn('2026-04-16', 1000, 'SIP MUTUAL FUND XYZ123'), txn('2026-05-16', 1020, 'SIP MUTUAL FUND XYZ124'), txn('2026-06-16', 980, 'SIP MUTUAL FUND XYZ125')],
      ASOF
    );
    expect(result).toHaveLength(1);
  });

  it('rejects irregular (non-monthly) gaps', () => {
    const result = detectRecurringDebits(
      [txn('2026-01-01', 500, 'RANDOM MERCHANT PAYMENT'), txn('2026-02-01', 500, 'RANDOM MERCHANT PAYMENT'), txn('2026-02-15', 500, 'RANDOM MERCHANT PAYMENT')],
      ASOF
    );
    expect(result).toHaveLength(0);
  });

  it('requires at least 3 occurrences', () => {
    const result = detectRecurringDebits([txn('2026-05-16', 7912, 'OFFUS EMI PRIN NB 05'), txn('2026-06-16', 7912, 'OFFUS EMI PRIN NB 05')], ASOF);
    expect(result).toHaveLength(0);
  });

  it('excludes credit-direction transactions entirely, even if the pattern would otherwise qualify', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-04-16', 7912, 'SALARY CREDIT COMPANY XYZ', 'credit'),
        txn('2026-05-16', 7912, 'SALARY CREDIT COMPANY XYZ', 'credit'),
        txn('2026-06-16', 7912, 'SALARY CREDIT COMPANY XYZ', 'credit'),
      ],
      ASOF
    );
    expect(result).toHaveLength(0);
  });

  it('excludes a description that reduces to nothing usable (all digits/punctuation)', () => {
    const result = detectRecurringDebits(
      [txn('2026-04-16', 500, '123456'), txn('2026-05-16', 500, '123457'), txn('2026-06-16', 500, '123458')],
      ASOF
    );
    expect(result).toHaveLength(0);
  });

  it('excludes a stale pattern whose predicted next date is well in the past', () => {
    const result = detectRecurringDebits(
      [txn('2025-11-16', 999, 'OLD CANCELLED SUBSCRIPTION'), txn('2025-12-16', 999, 'OLD CANCELLED SUBSCRIPTION'), txn('2026-01-16', 999, 'OLD CANCELLED SUBSCRIPTION')],
      ASOF
    );
    // predicted next: 2026-02-16, which is > 10 days before ASOF (2026-07-08) - stale.
    expect(result).toHaveLength(0);
  });

  it('accepts a Bills & Utilities pattern despite amounts varying well past 5% (usage-based), using the average', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-04-05', 1200, 'BSES ELECTRICITY BILL', 'debit', 'Bills & Utilities'),
        txn('2026-05-05', 2400, 'BSES ELECTRICITY BILL', 'debit', 'Bills & Utilities'),
        txn('2026-06-05', 1800, 'BSES ELECTRICITY BILL', 'debit', 'Bills & Utilities'),
      ],
      ASOF
    );
    expect(result).toHaveLength(1);
    expect(result[0].expectedAmount).toBe(1800); // mean of 1200, 2400, 1800
    expect(result[0].isEstimate).toBe(true);
  });

  it('still requires monthly-like spacing for a Bills & Utilities pattern', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-01-05', 1200, 'BSES ELECTRICITY BILL', 'debit', 'Bills & Utilities'),
        txn('2026-02-05', 2400, 'BSES ELECTRICITY BILL', 'debit', 'Bills & Utilities'),
        txn('2026-02-20', 1800, 'BSES ELECTRICITY BILL', 'debit', 'Bills & Utilities'),
      ],
      ASOF
    );
    expect(result).toHaveLength(0);
  });

  it('marks a consistent-amount (non-variable-category) pattern as not an estimate', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-04-16', 7912, 'OFFUS EMI PRIN NB 05', 'debit', 'EMI & Loan Payments'),
        txn('2026-05-16', 7912, 'OFFUS EMI PRIN NB 05', 'debit', 'EMI & Loan Payments'),
        txn('2026-06-16', 7912, 'OFFUS EMI PRIN NB 05', 'debit', 'EMI & Loan Payments'),
      ],
      ASOF
    );
    expect(result).toHaveLength(1);
    expect(result[0].isEstimate).toBe(false);
  });

  it('tolerates a single skipped-cycle gap in an otherwise-monthly pattern', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-02-05', 20000, 'NET BANKING SI HOUSEHOLD EXPENSES'),
        txn('2026-03-07', 20000, 'NET BANKING SI HOUSEHOLD EXPENSES'),
        // 62-day gap here (one missed month) instead of the usual ~30.
        txn('2026-05-08', 20000, 'NET BANKING SI HOUSEHOLD EXPENSES'),
        txn('2026-06-08', 20000, 'NET BANKING SI HOUSEHOLD EXPENSES'),
      ],
      ASOF
    );
    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBe(4);
  });

  it('rejects a pattern with more than one wide gap', () => {
    const result = detectRecurringDebits(
      [
        txn('2026-01-01', 20000, 'IRREGULAR TRANSFER'),
        // 62-day gap
        txn('2026-03-04', 20000, 'IRREGULAR TRANSFER'),
        // another 62-day gap
        txn('2026-05-05', 20000, 'IRREGULAR TRANSFER'),
        txn('2026-06-05', 20000, 'IRREGULAR TRANSFER'),
      ],
      ASOF
    );
    expect(result).toHaveLength(0);
  });

  it('sorts multiple recurring groups by soonest expected date', () => {
    const result = detectRecurringDebits(
      [
        // Expected 2026-07-20
        txn('2026-04-20', 500, 'NETFLIX SUBSCRIPTION'),
        txn('2026-05-20', 500, 'NETFLIX SUBSCRIPTION'),
        txn('2026-06-20', 500, 'NETFLIX SUBSCRIPTION'),
        // Expected 2026-07-10
        txn('2026-04-10', 7912, 'HOME LOAN EMI PAYMENT'),
        txn('2026-05-10', 7912, 'HOME LOAN EMI PAYMENT'),
        txn('2026-06-10', 7912, 'HOME LOAN EMI PAYMENT'),
      ],
      ASOF
    );
    expect(result).toHaveLength(2);
    expect(result[0].expectedDate).toBe('2026-07-10');
    expect(result[1].expectedDate).toBe('2026-07-20');
  });
});
