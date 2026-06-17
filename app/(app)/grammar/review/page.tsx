'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PartyPopper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { apiGet } from '@/lib/api/client';
import { postOrQueue } from '@/lib/offline/outbox';
import { buttonVariants, Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';
import { GermanCharBar, handleGermanAltKey } from '@/components/writing/german-char-bar';
import { useInsertableField } from '@/components/writing/use-insertable-field';
import { cn } from '@/lib/utils';

interface GrammarReviewCard {
  id: string;
  grammarTopic: {
    id: string;
    title: string;
    category: string;
    cefrLevel?: string | null;
    explanationRu: string;
    examplesJson?: Array<{ de: string; ru?: string }> | null;
    pitfallsJson?: string[] | null;
  };
}

const GRADES = [
  { grade: 1, key: 'again', variant: 'destructive' as const },
  { grade: 3, key: 'hard', variant: 'outline' as const },
  { grade: 4, key: 'good', variant: 'secondary' as const },
  { grade: 5, key: 'easy', variant: 'success' as const },
] as const;

export default function GrammarReviewPage() {
  const t = useTranslations('review');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['grammar-review-queue'],
    queryFn: () => apiGet<{ items: GrammarReviewCard[]; count: number }>('/api/grammar/review?limit=20'),
  });

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const { ref: draftRef, insert: insertDraft } = useInsertableField<HTMLTextAreaElement>(draft, setDraft);

  const items = data?.items ?? [];
  const current = items[index];

  async function grade(g: number) {
    if (!current || busy) return;
    setBusy(true);
    try {
      // postOrQueue advances even offline — the grade is queued and synced later.
      await postOrQueue('/api/grammar/review', { grammarTopicId: current.grammarTopic.id, grade: g });
      setRevealed(false);
      setDraft('');
      setIndex((i) => i + 1);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  const done = !current;
  const topic = current?.grammarTopic;
  const examples = (topic?.examplesJson ?? []).filter((e) => e && e.de);
  const pitfalls = topic?.pitfallsJson ?? [];

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center p-6">
      {done ? (
        <Card className="mt-10 w-full text-center">
          <CardContent className="flex flex-col items-center gap-3 p-8">
            <PartyPopper className="h-10 w-10 text-primary" />
            <h2 className="font-display text-xl font-bold">{t('doneTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {items.length > 0 ? t('doneText', { count: items.length }) : t('doneEmpty')}
            </p>
            <div className="mt-2 flex gap-2">
              <Link href="/grammar" className={cn(buttonVariants({ variant: 'outline' }))}>
                {t('toGrammar')}
              </Link>
              <Link href="/dashboard" className={cn(buttonVariants())} onClick={() => qc.invalidateQueries()}>
                {t('toDashboard')}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{t('progress', { index: index + 1, total: items.length })}</p>
          <Card className="w-full">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2">
                <Badge variant="default">{topic!.category}</Badge>
                {topic!.cefrLevel ? <Badge variant="muted">{topic!.cefrLevel}</Badge> : null}
              </div>
              <h2 className="font-display text-2xl font-bold">{topic!.title}</h2>
              <p className="text-sm text-muted-foreground">{t('grammarPrompt')}</p>

              {!revealed ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    ref={draftRef}
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => handleGermanAltKey(e, insertDraft)}
                    placeholder={t('grammarHint')}
                    className="min-h-[80px]"
                  />
                  <GermanCharBar onInsert={insertDraft} />
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{topic!.explanationRu}</p>
                  {examples.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {examples.map((ex, i) => (
                        <li key={i} className="text-sm">
                          <span className="de font-semibold">{ex.de}</span>
                          {ex.ru ? <span className="text-muted-foreground"> — {ex.ru}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {pitfalls.length > 0 && (
                    <div className="rounded-lg bg-amber/10 p-3 text-sm">
                      <p className="mb-1 font-semibold">{t('pitfalls')}</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {pitfalls.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-5 w-full">
            {!revealed ? (
              <Button className="w-full" onClick={() => setRevealed(true)}>
                {t('showRule')}
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((g) => (
                  <Button key={g.grade} variant={g.variant} disabled={busy} onClick={() => grade(g.grade)}>
                    {t(g.key)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
