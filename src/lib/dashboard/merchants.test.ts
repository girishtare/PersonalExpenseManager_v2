import { describe, expect, it } from 'vitest';
import { attachMerchantTrend, computeTopMerchants, type MerchantTrendTxn } from './merchants';
import type { MonthBucket } from './category-trend';

describe('computeTopMerchants', () => {
  it('sorts by size of change, not absolute spend', () => {
    const result = computeTopMerchants(
      [
        { description_raw: 'BIG STABLE MERCHANT', amount: 10000 },
        { description_raw: 'SMALL BUT DOUBLED', amount: 400 },
      ],
      [
        { description_raw: 'BIG STABLE MERCHANT', amount: 9900 },
        { description_raw: 'SMALL BUT DOUBLED', amount: 100 },
      ]
    );
    expect(result[0].name).toBe('SMALL BUT DOUBLED');
  });

  it('includes a merchant present only in the previous period, as a drop to zero', () => {
    const result = computeTopMerchants([], [{ description_raw: 'CANCELLED SUB', amount: 500 }]);
    // No current-period row to source a display name from, so it falls back to the reduced key.
    expect(result).toEqual([{ key: 'cancelled sub', name: 'cancelled sub', current: 0, previous: 500, delta: -500 }]);
  });

  it('excludes a description that reduces to nothing usable', () => {
    const result = computeTopMerchants([{ description_raw: '123', amount: 100 }], []);
    expect(result).toHaveLength(0);
  });
});

describe('attachMerchantTrend', () => {
  const BUCKETS: MonthBucket[] = [
    { startKey: '2026-05-01', endKey: '2026-05-31', label: 'May 2026' },
    { startKey: '2026-06-01', endKey: '2026-06-30', label: 'Jun 2026' },
    { startKey: '2026-07-01', endKey: '2026-07-31', label: 'Jul 2026' },
  ];

  function trendTxn(txn_date: string, amount: number, description_raw: string): MerchantTrendTxn {
    return { txn_date, amount, description_raw };
  }

  it('builds a per-month trend aligned to the given buckets, zero-filling gaps', () => {
    const result = attachMerchantTrend(
      [{ key: 'swiggy', name: 'Swiggy' }],
      [trendTxn('2026-05-10', 300, 'Swiggy'), trendTxn('2026-07-02', 450, 'Swiggy')],
      BUCKETS
    );
    expect(result).toEqual([
      {
        key: 'swiggy',
        name: 'Swiggy',
        trend: [
          { month: 'May 2026', amount: 300 },
          { month: 'Jun 2026', amount: 0 },
          { month: 'Jul 2026', amount: 450 },
        ],
      },
    ]);
  });

  it('sums multiple transactions in the same month for the same merchant', () => {
    const result = attachMerchantTrend(
      [{ key: 'swiggy', name: 'Swiggy' }],
      [trendTxn('2026-06-01', 100, 'Swiggy'), trendTxn('2026-06-15', 200, 'Swiggy')],
      BUCKETS
    );
    expect(result[0].trend[1]).toEqual({ month: 'Jun 2026', amount: 300 });
  });

  it('does not mix up two different merchants', () => {
    const result = attachMerchantTrend(
      [
        { key: 'swiggy', name: 'Swiggy' },
        { key: 'zomato', name: 'Zomato' },
      ],
      [trendTxn('2026-06-01', 100, 'Swiggy'), trendTxn('2026-06-01', 999, 'Zomato')],
      BUCKETS
    );
    expect(result.find((m) => m.key === 'swiggy')?.trend[1].amount).toBe(100);
    expect(result.find((m) => m.key === 'zomato')?.trend[1].amount).toBe(999);
  });

  it('returns an all-zero trend for a merchant with no rows in the trend window', () => {
    const result = attachMerchantTrend([{ key: 'nowhere', name: 'Nowhere' }], [], BUCKETS);
    expect(result[0].trend.map((t) => t.amount)).toEqual([0, 0, 0]);
  });
});
