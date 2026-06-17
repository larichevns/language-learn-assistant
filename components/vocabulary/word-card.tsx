'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SpeakButton } from '@/components/ui/speak-button';
import type { GroupOption } from '@/components/groups/types';
import type { VocabRow } from './types';

const UNGROUPED_VALUE = '__ungrouped__';

export function WordCard({
  word,
  options,
  moving,
  onMove,
}: {
  word: VocabRow;
  options: GroupOption[];
  moving: boolean;
  onMove: (groupId: string | null) => void;
}) {
  const t = useTranslations('vocab');
  const tg = useTranslations('group');
  const dueNow = (word.srsCards ?? []).some((c) => new Date(c.dueAt) <= new Date());

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="de font-display text-lg">
              {word.gender ? `${word.gender.toLowerCase()} ${word.lemma.replace(/^(der|die|das)\s+/i, '')}` : word.lemma}
            </span>
            <SpeakButton text={word.lemma} />
          </div>
          {word.cefrLevel && <Badge variant="muted">{word.cefrLevel}</Badge>}
        </div>
        <span className="text-sm text-muted-foreground">{word.translationRu}</span>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {word.pluralForm && <Badge variant="deutsch">pl. {word.pluralForm}</Badge>}
            {dueNow && <Badge variant="default">{t('dueBadge')}</Badge>}
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            {moving && <Spinner className="text-muted-foreground" />}
            <Select
              value={word.groupId ?? UNGROUPED_VALUE}
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
        </div>
      </CardContent>
    </Card>
  );
}
