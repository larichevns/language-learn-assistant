'use client';

import { CalendarDays, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A single-button toggle between two sort modes. Labels are passed in so the
 * component stays i18n-agnostic (mirrors SearchInput's placeholder prop).
 */
export function SortToggle({
  mode,
  onChange,
  recentLabel,
  dateLabel,
}: {
  mode: 'recent' | 'entryDate';
  onChange: (m: 'recent' | 'entryDate') => void;
  recentLabel: string;
  dateLabel: string;
}) {
  const isDate = mode === 'entryDate';
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={isDate}
      onClick={() => onChange(isDate ? 'recent' : 'entryDate')}
    >
      {isDate ? <CalendarDays className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {isDate ? dateLabel : recentLabel}
    </Button>
  );
}
