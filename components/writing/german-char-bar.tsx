'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Grouped so the umlauts, their capitals and the German quotes read as three sets.
const GROUPS: string[][] = [
  ['ä', 'ö', 'ü', 'ß'],
  ['Ä', 'Ö', 'Ü', 'ẞ'],
  ['„', '“'],
];

/** Alt+<key> → lowercase German letter. */
export const GERMAN_ALT_MAP: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü', s: 'ß' };
// Explicit caps map: 'ß'.toUpperCase() is "SS" in JS, not the capital eszett 'ẞ'.
const GERMAN_CAPS: Record<string, string> = { ä: 'Ä', ö: 'Ö', ü: 'Ü', ß: 'ẞ' };

/**
 * Handle an Alt+a/o/u/s shortcut on a text field. Returns true if it consumed
 * the event (so callers can `if (handleGermanAltKey(e, insert)) return;`).
 * Ignores AltGr (Ctrl+Alt on Windows) to avoid hijacking other layouts.
 */
export function handleGermanAltKey(e: React.KeyboardEvent, insert: (text: string) => void): boolean {
  if (e.ctrlKey || e.metaKey || !e.altKey) return false;
  const base = GERMAN_ALT_MAP[e.key.toLowerCase()];
  if (!base) return false;
  e.preventDefault();
  insert(e.shiftKey ? (GERMAN_CAPS[base] ?? base) : base);
  return true;
}

/**
 * A row of quick-insert chips for German special characters. `onInsert` should
 * drop the character at the field's caret (see {@link useInsertableField}).
 *
 * Chips fire on `onMouseDown` + `preventDefault()` and are `tabIndex={-1}` so a
 * click never steals focus from the text field — the caret/selection survive.
 */
export function GermanCharBar({
  onInsert,
  className,
}: {
  onInsert: (char: string) => void;
  className?: string;
}) {
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {group.map((char) => (
            <button
              key={char}
              type="button"
              tabIndex={-1}
              aria-label={t('insertChar', { char })}
              onMouseDown={(e) => {
                e.preventDefault();
                onInsert(char);
              }}
              className="flex h-7 min-w-[28px] items-center justify-center rounded-md border border-border bg-card px-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {char}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
