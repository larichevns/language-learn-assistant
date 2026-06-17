import type { MutableRefObject, Ref } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional + conflicting Tailwind classes (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Fan one DOM node out to several refs. Needed when a component keeps an
 * internal ref (e.g. an autosizing textarea measuring itself) yet must still
 * forward a ref to the caller (e.g. for caret/selection control).
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    }
  };
}
