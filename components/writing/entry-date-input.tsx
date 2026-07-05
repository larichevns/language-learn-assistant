'use client';

import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';

/**
 * A chip-styled native date picker. `value` is an ISO string (or null); the chip
 * shows/edits the local calendar day. We anchor the chosen day at local NOON so a
 * timezone offset can never shift it to the previous/next day, and we never build
 * a Date from null/'' (which would throw RangeError).
 */
export function EntryDateInput({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="date"
        aria-label={label ?? 'entry date'}
        value={value ? format(new Date(value), 'yyyy-MM-dd') : ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : new Date(`${v}T12:00:00`).toISOString());
        }}
        className="bg-transparent text-base outline-none"
      />
    </label>
  );
}
