// Deliberately local-calendar-date arithmetic throughout (Date constructed from
// year/month/day components), never toISOString()/UTC-based math - see toDateKey below for why.

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Shifts a date by whole calendar months, clamping the day when the target month is shorter
 * (e.g. Mar 31 - 1 month -> Feb 28/29, not Mar 3). JS's Date constructor already normalizes an
 * out-of-range month index (month -1 rolls back to December of the previous year), so only the
 * day needs explicit clamping.
 */
export function shiftByMonths(date: Date, months: number): Date {
  const targetMonthFirst = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const clampedDay = Math.min(date.getDate(), daysInMonth(targetMonthFirst));
  return new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth(), clampedDay);
}

/**
 * The "same days last month" comparison window: for a selected [start, end] range, the
 * previous-month window covering the same day-of-month span (e.g. 1-8 Jul -> 1-8 Jun). Each
 * endpoint is shifted independently and clamped to its own target month's length, so a range
 * ending on the 31st correctly lands on the 28th/29th/30th in a shorter month.
 */
export function sameDaysLastMonth(start: Date, end: Date): { start: Date; end: Date } {
  return { start: shiftByMonths(start, -1), end: shiftByMonths(end, -1) };
}

export interface MtdBadge {
  day: number;
  totalDays: number;
}

/**
 * "MTD - day X of Y" badge info: shown when the selected range sits inside a single calendar
 * month that isn't yet complete (end isn't that month's last day). Returns null for a full
 * month, or a range spanning more than one calendar month.
 */
export function computeMtdBadge(start: Date, end: Date): MtdBadge | null {
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (!sameMonth) return null;
  const totalDays = daysInMonth(end);
  const day = end.getDate();
  if (day >= totalDays) return null;
  return { day, totalDays };
}

/** Linear projection of a month's total from partial-month spend, using the same day/totalDays as the MTD badge. Degenerates to `spent` at month-end (day === totalDays). */
export function projectMonthEnd(spent: number, end: Date): number {
  const totalDays = daysInMonth(end);
  const day = end.getDate();
  return (spent * totalDays) / day;
}
