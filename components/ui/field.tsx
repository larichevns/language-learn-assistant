'use client';

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cn, mergeRefs } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

// useLayoutEffect warns during SSR; client components still render on the server
// for the first paint, so fall back to useEffect there (isomorphic pattern).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Grow a textarea to fit its content. Resets to `auto` first so it can shrink,
 *  then adds the border delta (scrollHeight excludes borders under border-box). */
function fitToContent(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with content instead of scrolling inside a fixed box (default: true). */
  autoSize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, autoSize = true, onInput, ...props }, ref) {
    const innerRef = useRef<HTMLTextAreaElement>(null);

    const fit = useCallback(() => {
      if (autoSize && innerRef.current) fitToContent(innerRef.current);
    }, [autoSize]);

    // Re-fit on mount and whenever the controlled value changes.
    useIsoLayoutEffect(() => {
      fit();
    }, [fit, props.value]);

    // Width changes rewrap lines, which changes the needed height.
    useEffect(() => {
      if (!autoSize) return;
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }, [autoSize, fit]);

    return (
      <textarea
        ref={mergeRefs(innerRef, ref)}
        onInput={(e) => {
          fit();
          onInput?.(e);
        }}
        className={cn(
          'flex min-h-[96px] w-full rounded-lg border border-input bg-background px-4 py-3 text-base leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          autoSize && 'resize-none overflow-hidden',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none text-foreground', className)} {...props} />;
}
