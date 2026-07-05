'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ProposalCard } from '@/components/assistant/proposal-card';
import { useGroupCollapse } from '@/components/groups/use-collapse';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';
import { SearchInput } from '@/components/ui/search-input';
import { SortToggle } from '@/components/ui/sort-toggle';
import { apiGet, apiPost } from '@/lib/api/client';
import type { ChatProposal } from '@/lib/ai-client/chat-stream';

interface SetRow {
  id: string;
  title: string;
  entryDate: string;
  status: string;
  score?: number | null;
  grammarTopicId?: string | null;
  grammarTopic?: { title: string } | null;
  _count?: { items: number };
}
interface GrammarRow {
  id: string;
  title: string;
}

// Sentinel bucket id for sets not linked to a grammar topic (manual/other).
const OTHER_BUCKET = '__other__';

function SetCard({ s, takeLabel, tasksLabel }: { s: SetRow; takeLabel: string; tasksLabel: string }) {
  const f = useFormatter();
  return (
    <Link href={`/exercises/${s.id}`}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.title}</p>
            <p className="text-sm text-muted-foreground">
              {tasksLabel} · {f.dateTime(new Date(s.entryDate), { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {s.status === 'GRADED' && s.score != null ? (
            <Badge variant="success">{Math.round(s.score * 100)}%</Badge>
          ) : (
            <Badge variant="muted">{takeLabel}</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ExercisesPage() {
  const t = useTranslations('exercises');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['exercises'], queryFn: () => apiGet<{ items: SetRow[] }>('/api/exercises?pageSize=100') });
  const grammar = useQuery({ queryKey: ['grammar'], queryFn: () => apiGet<{ items: GrammarRow[] }>('/api/grammar?pageSize=100') });

  const [count, setCount] = useState(5);
  const [grammarTopicId, setGrammarTopicId] = useState('');
  const [proposals, setProposals] = useState<ChatProposal[]>([]);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'recent' | 'entryDate'>('recent');
  const [open, setOpen] = useGroupCollapse('lla:exercises:open-buckets');

  const generate = useMutation({
    mutationFn: () => apiPost<{ proposals: ChatProposal[] }>('/api/exercises/generate', { count, grammarTopicId: grammarTopicId || undefined }),
    onSuccess: (res) => setProposals(res.proposals),
  });

  // Derived buckets: group sets by their linked grammar topic, with a trailing
  // "other" bucket for manual / topic-less sets. Presentation only — no CRUD.
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!q) return items;
    return items.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.grammarTopic?.title ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const sortedSets = useMemo(() => {
    if (sortMode === 'recent') return filteredSets;
    return [...filteredSets].sort((a, b) => Date.parse(b.entryDate) - Date.parse(a.entryDate));
  }, [filteredSets, sortMode]);

  const buckets = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; items: SetRow[] }>();
    const other: SetRow[] = [];
    for (const s of sortedSets) {
      if (s.grammarTopicId) {
        const label = s.grammarTopic?.title ?? s.grammarTopicId;
        const existing = byId.get(s.grammarTopicId);
        if (existing) existing.items.push(s);
        else byId.set(s.grammarTopicId, { id: s.grammarTopicId, label, items: [s] });
      } else {
        other.push(s);
      }
    }
    const topicBuckets = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (other.length > 0) topicBuckets.push({ id: OTHER_BUCKET, label: t('bucketOther'), items: other });
    return topicBuckets;
  }, [sortedSets, t]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <select className="h-10 max-w-full rounded-lg border border-input bg-background px-3 text-sm" value={grammarTopicId} onChange={(e) => setGrammarTopicId(e.target.value)}>
            <option value="">{t('byCurrentUnit')}</option>
            {grammar.data?.items.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <Input type="number" min={1} max={20} className="w-20" value={count} onChange={(e) => setCount(Number(e.target.value) || 5)} />
          <Button className="gap-2" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <Spinner /> : <Sparkles className="h-4 w-4" />} {t('generate')}
          </Button>
        </CardContent>
      </Card>

      {proposals.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onResolved={() => void qc.invalidateQueries({ queryKey: ['exercises'] })} />
          ))}
        </div>
      )}

      {(data?.items?.length ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} clearLabel={tc('clearSearch')} />
          </div>
          <SortToggle mode={sortMode} onChange={setSortMode} recentLabel={tc('sortRecent')} dateLabel={tc('sortByDate')} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-primary" />
        </div>
      ) : buckets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <Accordion type="multiple" value={open} onValueChange={setOpen} className="flex flex-col gap-2">
          {buckets.map((b) => (
            <AccordionItem key={b.id} value={b.id} className="border-b-0">
              <AccordionTrigger className="border-b border-border py-3 font-display text-base font-semibold no-underline hover:no-underline">
                <span className="flex items-baseline gap-2">
                  {b.label}
                  <span className="text-sm font-normal text-muted-foreground">{b.items.length}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-2 pb-4 pt-3">
                {b.items.map((s) => (
                  <SetCard key={s.id} s={s} takeLabel={t('take')} tasksLabel={t('tasks', { count: s._count?.items ?? 0 })} />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
