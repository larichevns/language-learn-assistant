'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { GroupOption } from '@/components/groups/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UNGROUPED_VALUE = '__ungrouped__';

/** A grammar topic row as the list endpoint returns it (subset the card needs). */
export interface GrammarRow {
  id: string;
  title: string;
  category: string;
  cefrLevel?: string | null;
  masteryScore: number;
  groupId?: string | null;
}

/**
 * Grammar leaf card for the grouped accordion. Mirrors WordCard's contract
 * ({ topic, options, moving, onMove }): the card body links to the topic detail,
 * while the "Move to…" Select sits beside it (outside the Link so picking a group
 * never navigates).
 */
export function GrammarTopicCard({
  topic,
  options,
  moving,
  onMove,
}: {
  topic: GrammarRow;
  options: GroupOption[];
  moving: boolean;
  onMove: (groupId: string | null) => void;
}) {
  const t = useTranslations('grammar');
  const tg = useTranslations('group');
  const pct = Math.round(topic.masteryScore * 100);

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <Link href={`/grammar/${topic.id}`} className="flex flex-col gap-2 transition-colors hover:text-primary">
          <div className="flex items-start justify-between gap-2">
            <span className="font-display font-semibold leading-tight">{topic.title}</span>
            {topic.cefrLevel && <Badge variant="muted">{topic.cefrLevel}</Badge>}
          </div>
          <Badge variant="secondary" className="self-start">
            {topic.category}
          </Badge>
          <div className="mt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">{t('mastery', { pct })}</span>
          </div>
        </Link>
        <div className="mt-auto flex items-center justify-end gap-1.5 pt-1">
          {moving && <Spinner className="text-muted-foreground" />}
          <Select
            value={topic.groupId ?? UNGROUPED_VALUE}
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
