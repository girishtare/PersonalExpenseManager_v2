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

  it('uses a real raw description from the previous period as the name, never the bare key', () => {
    const result = computeTopMerchants([], [{ description_raw: 'CANCELLED SUB', amount: 500 }]);
    expect(result).toEqual([
      { key: 'cancelled sub', name: 'CANCELLED SUB', current: 0, previous: 500, delta: -500, history: [] },
    ]);
  });

  it('excludes a description that reduces to nothing usable', () => {
    const result = computeTopMerchants([{ description_raw: '123', amount: 100 }], []);
    expect(result).toHaveLength(0);
  });

  it('attaches labeled extra-period history without affecting delta or sort order', () => {
    const result = computeTopMerchants(
      [{ description_raw: 'SWIGGY', amount: 500 }],
      [{ description_raw: 'SWIGGY', amount: 400 }],
      [
        { label: 'May 2026', rows: [{ description_raw: 'SWIGGY', amount: 300 }] },
        { label: 'Apr 2026', rows: [{ description_raw: 'SWIGGY', amount: 700 }] },
      ]
    );
    expect(result[0].delta).toBe(100); // still current - previous, unaffected by history
    expect(result[0].history).toEqual([
      { label: 'May 2026', amount: 300 },
      { label: 'Apr 2026', amount: 700 },
    ]);
  });

  it('zero-fills an extra period with no matching activity', () => {
    const result = computeTopMerchants(
      [{ description_raw: 'SWIGGY', amount: 500 }],
      [],
      [{ label: 'May 2026', rows: [{ description_raw: 'ZOMATO', amount: 300 }] }]
    );
    expect(result[0].history).toEqual([{ label: 'May 2026', amount: 0 }]);
  });

  it('includes a merchant with activity only in an extra period, not current/previous', () => {
    const result = computeTopMerchants(
      [],
      [],
      [{ label: 'May 2026', rows: [{ description_raw: 'ONLY IN MAY', amount: 300 }] }]
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ONLY IN MAY');
    expect(result[0].history).toEqual([{ label: 'May 2026', amount: 300 }]);
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
