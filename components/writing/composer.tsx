'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';
import { GermanCharBar, handleGermanAltKey } from './german-char-bar';
import { useInsertableField } from './use-insertable-field';

export interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Pass to render an inline, borderless title field above the body. */
  title?: string;
  onTitleChange?: (next: string) => void;
  titlePlaceholder?: string;
  /** ⌘↵ / Ctrl+↵ triggers this; also wired to the submit button. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Show the German special-character bar (default: true). */
  german?: boolean;
  /** Show the word counter (default: true). */
  counter?: boolean;
  /** Controls in the action row, left of the submit button (e.g. a photo button). */
  footerLeft?: ReactNode;
  /** Extra content inside the frame, below the actions (e.g. an image preview). */
  children?: ReactNode;
}

/**
 * A comfortable, single-surface writing field: optional title, an auto-growing
 * body, a German character bar, a live word count and a ⌘↵ submit. The whole
 * frame lights up on focus (focus-within) so it reads as one place to write.
 */
export function Composer({
  value,
  onChange,
  placeholder,
  title,
  onTitleChange,
  titlePlaceholder,
  onSubmit,
  submitLabel,
  submitting = false,
  submitDisabled = false,
  german = true,
  counter = true,
  footerLeft,
  children,
}: ComposerProps) {
  const t = useTranslations('common');
  const { ref, insert } = useInsertableField<HTMLTextAreaElement>(value, onChange);

  const chars = value.length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const canSubmit = Boolean(onSubmit) && !submitting && !submitDisabled;

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (handleGermanAltKey(e, insert)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring">
      {title !== undefined && (
        <>
          <input
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder={titlePlaceholder}
            className="w-full bg-transparent px-4 pb-2.5 pt-3.5 text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
          />
          <div className="mx-4 border-b border-border" />
        </>
      )}

      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-h-[120px] rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />

      {(german || counter) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {german ? <GermanCharBar onInsert={insert} /> : <span />}
          {counter && (
            <span title={t('chars', { n: chars })} className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t('words', { n: words })}
            </span>
          )}
        </div>
      )}

      {(onSubmit || footerLeft) && (
        <div className="flex flex-wrap items-center gap-3 px-3 pb-3 pt-1">
          {footerLeft}
          {onSubmit && (
            <div className="ml-auto flex items-center gap-2">
              <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">
                ⌘↵
              </kbd>
              <Button onClick={onSubmit} disabled={!canSubmit}>
                {submitting ? <Spinner /> : submitLabel}
              </Button>
            </div>
          )}
        </div>
      )}

      {children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
