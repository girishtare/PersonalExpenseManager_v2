import { describe, expect, it } from 'vitest';
import { computeMtdBadge, daysInMonth, parseDateKey, projectMonthEnd, sameDaysLastMonth, shiftByMonths, toDateKey } from './period';

const d = (key: string) => parseDateKey(key);

describe('shiftByMonths', () => {
  it('shifts a plain mid-month date back one month', () => {
    expect(toDateKey(shiftByMonths(d('2026-07-08'), -1))).toBe('2026-06-08');
  });

  it('rolls back across a year boundary', () => {
    expect(toDateKey(shiftByMonths(d('2026-01-15'), -1))).toBe('2025-12-15');
  });

  it('clamps the 31st into a 30-day month', () => {
    // April has 30 days.
    expect(toDateKey(shiftByMonths(d('2026-05-31'), -1))).toBe('2026-04-30');
  });

  it('clamps the 31st into February on a non-leap year', () => {
    expect(toDateKey(shiftByMonths(d('2026-03-31'), -1))).toBe('2026-02-28');
  });

  it('clamps the 31st into February on a leap year', () => {
    expect(toDateKey(shiftByMonths(d('2024-03-31'), -1))).toBe('2024-02-29');
  });

  it('shifts forward too (positive months)', () => {
    expect(toDateKey(shiftByMonths(d('2026-01-31'), 1))).toBe('2026-02-28');
  });
});

describe('sameDaysLastMonth', () => {
  it('matches the canonical example: 1-8 Jul compares against 1-8 Jun', () => {
    const result = sameDaysLastMonth(d('2026-07-01'), d('2026-07-08'));
    expect(toDateKey(result.start)).toBe('2026-06-01');
    expect(toDateKey(result.end)).toBe('2026-06-08');
  });

  it('clamps each endpoint independently for a range spanning two months', () => {
    // 25 Jun - 5 Jul this "month pair" -> 25 May - 5 Jun.
    const result = sameDaysLastMonth(d('2026-06-25'), d('2026-07-05'));
    expect(toDateKey(result.start)).toBe('2026-05-25');
    expect(toDateKey(result.end)).toBe('2026-06-05');
  });

  it('clamps a full 31-day month to the shorter previous month independently at each end', () => {
    // 1-31 Jul -> 1 Jun (30 days, no clamp needed) - 30 Jun (clamped from 31).
    const result = sameDaysLastMonth(d('2026-07-01'), d('2026-07-31'));
    expect(toDateKey(result.start)).toBe('2026-06-01');
    expect(toDateKey(result.end)).toBe('2026-06-30');
  });
});

describe('computeMtdBadge', () => {
  it('returns day/totalDays for a partial month', () => {
    expect(computeMtdBadge(d('2026-07-01'), d('2026-07-08'))).toEqual({ day: 8, totalDays: 31 });
  });

  it('returns null for a complete month', () => {
    expect(computeMtdBadge(d('2026-07-01'), d('2026-07-31'))).toBeNull();
  });

  it('returns null when the range spans more than one calendar month', () => {
    expect(computeMtdBadge(d('2026-06-15'), d('2026-07-05'))).toBeNull();
  });

  it('handles February correctly on a non-leap year', () => {
    expect(computeMtdBadge(d('2026-02-01'), d('2026-02-28'))).toBeNull(); // complete
    expect(computeMtdBadge(d('2026-02-01'), d('2026-02-27'))).toEqual({ day: 27, totalDays: 28 });
  });

  it('handles February correctly on a leap year', () => {
    expect(computeMtdBadge(d('2024-02-01'), d('2024-02-29'))).toBeNull(); // complete
    expect(computeMtdBadge(d('2024-02-01'), d('2024-02-28'))).toEqual({ day: 28, totalDays: 29 });
  });
});

describe('projectMonthEnd', () => {
  it('extrapolates linearly from partial-month spend', () => {
    expect(projectMonthEnd(1000, d('2026-07-08'))).toBeCloseTo((1000 * 31) / 8, 5);
  });

  it('degenerates to the actual spend at month-end', () => {
    expect(projectMonthEnd(5000, d('2026-07-31'))).toBeCloseTo(5000, 5);
  });
});

describe('daysInMonth', () => {
  it('returns 31/30/28/29 correctly', () => {
    expect(daysInMonth(d('2026-01-15'))).toBe(31);
    expect(daysInMonth(d('2026-04-15'))).toBe(30);
    expect(daysInMonth(d('2026-02-15'))).toBe(28);
    expect(daysInMonth(d('2024-02-15'))).toBe(29);
  });
});
