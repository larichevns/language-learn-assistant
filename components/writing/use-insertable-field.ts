'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Insert text at the caret of a *controlled* text field and keep the caret in
 * the right place afterwards.
 *
 * Because the field is controlled, the value only changes on the next render —
 * so we stash the desired caret position and restore it in a layout effect once
 * React has committed the new value. Works for both <textarea> and <input>.
 *
 * Pair with a toolbar button that calls `insert` from `onMouseDown` +
 * `preventDefault()` so the field never loses focus / selection on the click.
 */
export function useInsertableField<T extends HTMLInputElement | HTMLTextAreaElement = HTMLTextAreaElement>(
  value: string,
  onChange: (next: string) => void,
) {
  const ref = useRef<T>(null);
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (pendingCaret.current != null && el) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const insert = useCallback(
    (text: string) => {
      const el = ref.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      onChange(value.slice(0, start) + text + value.slice(end));
      pendingCaret.current = start + text.length;
    },
    [value, onChange],
  );

  return { ref, insert };
}
