'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  /** Controlled value. */
  value: string;
  /** Called with the next value on every keystroke and on clear. */
  onChange: (value: string) => void;
  /** Translated placeholder — the component stays i18n-agnostic. */
  placeholder: string;
  /** Accessible label for the field (defaults to the placeholder). */
  ariaLabel?: string;
  /** Accessible label for the clear button. */
  clearLabel?: string;
  className?: string;
}

/** A controlled search field: leading magnifier, trailing clear button. */
export function SearchInput({ value, onChange, placeholder, ariaLabel, clearLabel, className }: SearchInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        role="searchbox"
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel ?? 'Clear'}
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
