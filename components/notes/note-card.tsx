'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { GroupOption } from '@/components/groups/types';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UNGROUPED_VALUE = '__ungrouped__';
const PREVIEW_CHARS = 90;

/** A note row as the list endpoint returns it (subset the card needs). */
export interface NoteRow {
  id: string;
  title?: string | null;
  rawInput: string;
  entryDate: string;
  groupId?: string | null;
}

/**
 * Note leaf card for the grouped accordion. Mirrors WordCard's contract: the body
 * links to the note detail, while the "Move to…" Select sits beside it (outside the
 * Link so picking a group never navigates).
 */
export function NoteCard({
  note,
  options,
  moving,
  onMove,
}: {
  note: NoteRow;
  options: GroupOption[];
  moving: boolean;
  onMove: (groupId: string | null) => void;
}) {
  const t = useTranslations('notes');
  const tg = useTranslations('group');
  const format = useFormatter();

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-1 p-4">
        <Link href={`/notes/${note.id}`} className="flex flex-col gap-1 transition-colors hover:text-primary">
          <p className="font-medium leading-tight">{note.title ?? t('noTitle')}</p>
          <p className="truncate text-sm text-muted-foreground">{note.rawInput.slice(0, PREVIEW_CHARS)}</p>
        </Link>
        <p className="text-xs text-muted-foreground">
          {format.dateTime(new Date(note.entryDate), { day: 'numeric', month: 'short' })}
        </p>
        <div className="mt-auto flex items-center justify-end gap-1.5 pt-2">
          {moving && <Spinner className="text-muted-foreground" />}
          <Select
            value={note.groupId ?? UNGROUPED_VALUE}
            disabled={moving}
            onValueChange={(v) => onMove(v === UNGROUPED_VALUE ? null : v)}
          >
            <SelectTrigger
              aria-label={tg('moveTo')}
              className="h-8 w-auto gap-1.5 rounded-lg border-border px-2.5 text-xs text-muted-foreground"
            >
              <SelectValue placeholder={tg('moveTo')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNGROUPED_VALUE}>{tg('ungrouped')}</SelectItem>
              {options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className={opt.depth === 1 ? 'pl-6' : undefined}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
