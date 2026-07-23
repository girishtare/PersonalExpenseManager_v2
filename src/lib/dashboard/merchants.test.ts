import { describe, expect, it } from 'vitest';
import { attachMerchantTrend, computeTopMerchants, type MerchantTrendTxn } from './merchants';
import type { MonthBucket } from './category-trend';

describe('computeTopMerchants', () => {
  it('sorts by average spend across history periods, not size of change or current-period spend', () => {
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
    // SMALL BUT DOUBLED changed the most (and the least in absolute terms), but BIG STABLE
    // MERCHANT has the higher average spend, so it should rank first now.
    expect(result[0].name).toBe('BIG STABLE MERCHANT');
  });

  it('uses a real raw description from the previous period as the name, never the bare key', () => {
    const result = computeTopMerchants([], [{ description_raw: 'CANCELLED SUB', amount: 500 }]);
    expect(result).toEqual([
      { key: 'cancelled sub', name: 'CANCELLED SUB', current: 0, previous: 500, delta: -500, avgSpend: 500, history: [] },
    ]);
  });

  it('excludes a description that reduces to nothing usable', () => {
    const result = computeTopMerchants([{ description_raw: '123', amount: 100 }], []);
    expect(result).toHaveLength(0);
  });

  it('attaches labeled extra-period history and averages it into the sort key alongside previous', () => {
    const result = computeTopMerchants(
      [{ description_raw: 'SWIGGY', amount: 500 }],
      [{ description_raw: 'SWIGGY', amount: 400 }],
      [
        { label: 'May 2026', rows: [{ description_raw: 'SWIGGY', amount: 300 }] },
        { label: 'Apr 2026', rows: [{ description_raw: 'SWIGGY', amount: 700 }] },
      ]
    );
    expect(result[0].delta).toBe(100); // still current - previous
    expect(result[0].avgSpend).toBe((400 + 300 + 700) / 3); // previous + extraPeriods, not current
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
    expect(result.find((r) => r.name === 'SWIGGY')?.history).toEqual([{ label: 'May 2026', amount: 0 }]);
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

  it('ranks a merchant with only current-period activity below one with real history', () => {
    const result = computeTopMerchants(
      [
        { description_raw: 'BRAND NEW MERCHANT', amount: 50000 },
        { description_raw: 'STEADY MERCHANT', amount: 1000 },
      ],
      [{ description_raw: 'STEADY MERCHANT', amount: 1000 }]
    );
    // BRAND NEW MERCHANT has no prior-period history (avgSpend 0) despite a huge current spend.
    expect(result.map((r) => r.name)).toEqual(['STEADY MERCHANT', 'BRAND NEW MERCHANT']);
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
