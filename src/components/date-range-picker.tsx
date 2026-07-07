'use client';

import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Deliberately local-calendar-date formatting, not toISOString() (which converts to UTC and
// would roll a local date back a day for any timezone ahead of UTC, e.g. IST).
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

function formatDisplay(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DateRangePicker({
  start,
  end,
  onChange,
  onClear,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const committedRange: DateRange = {
    from: start ? parseDateKey(start) : undefined,
    to: end ? parseDateKey(end) : undefined,
  };
  // Tracks the in-progress selection locally while the popover is open - only fires onChange
  // once a full range is picked. Committing on every partial click would trigger a full page
  // re-render mid-selection, wiping out the calendar's own from/to tracking before the user
  // can pick the second date.
  const [pendingRange, setPendingRange] = useState<DateRange>(committedRange);

  const label =
    committedRange.from && committedRange.to
      ? `${formatDisplay(committedRange.from)} – ${formatDisplay(committedRange.to)}`
      : 'All dates';

  return (
    <div className="flex items-center gap-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setPendingRange(committedRange); // reset to the committed range each time it opens
        }}
      >
        <PopoverTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-9 w-full justify-start gap-2 font-normal')}>
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar
            mode="range"
            defaultMonth={pendingRange.from ?? new Date()}
            selected={pendingRange}
            onSelect={(newRange) => {
              // react-day-picker collapses a click into a same-day {from, to} range when the
              // selection started empty (addToRange's empty-range branch), which would let a
              // single click satisfy "both ends set" and commit/close before a second date is
              // ever picked. Only accept that as a real 1-day range when `from` was already
              // pending (i.e. this really is the second click, on the same day as the first).
              const startedEmpty = !pendingRange.from && !pendingRange.to;
              const collapsedFirstClick =
                startedEmpty && newRange?.from && newRange?.to && newRange.from.getTime() === newRange.to.getTime();

              if (collapsedFirstClick) {
                setPendingRange({ from: newRange.from, to: undefined });
                return;
              }

              setPendingRange(newRange ?? { from: undefined, to: undefined });
              if (newRange?.from && newRange?.to) {
                onChange(toDateKey(newRange.from), toDateKey(newRange.to));
                setOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      {onClear && committedRange.from && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear date range">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
