'use client';

import { useCallback, useEffect, useState } from 'react';

function read(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Persisted open/closed state for a grouped accordion, keyed per node id.
 * Returns the list of open node ids plus a setter that mirrors to localStorage.
 *
 * Each domain passes a distinct `storageKey` (`lla:vocab:open-groups`,
 * `lla:grammar:open-groups`, …) so the accordions persist independently.
 *
 * Starts empty for SSR parity, then hydrates from storage on mount to avoid a
 * hydration mismatch (server has no localStorage).
 */
export function useGroupCollapse(storageKey: string): [string[], (next: string[]) => void] {
  const [open, setOpen] = useState<string[]>([]);

  useEffect(() => {
    setOpen(read(storageKey));
  }, [storageKey]);

  const update = useCallback(
    (next: string[]) => {
      setOpen(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode / quota) — collapse just won't persist
      }
    },
    [storageKey],
  );

  return [open, update];
}
