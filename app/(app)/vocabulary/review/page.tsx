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
import { Badge, Spinner } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/ui/speak-button';
import { cn } from '@/lib/utils';

interface ReviewCard {
  id: string;
  direction: string;
  vocabEntry: {
    id: string;
    lemma: string;
    pos: string;
    translationRu: string;
    gender?: string | null;
    pluralForm?: string | null;
    partizipII?: string | null;
    auxiliary?: string | null;
  };
}

const GRADES = [
  { grade: 1, key: 'again', variant: 'destructive' as const },
  { grade: 3, key: 'hard', variant: 'outline' as const },
  { grade: 4, key: 'good', variant: 'secondary' as const },
  { grade: 5, key: 'easy', variant: 'success' as const },
] as const;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/g, '');
const bareNoun = (lemma: string) => lemma.replace(/^(der|die|das)\s+/i, '');
function withArticle(v: ReviewCard['vocabEntry']): string {
  return v.gender ? `${v.gender.toLowerCase()} ${bareNoun(v.lemma)}` : v.lemma;
}

/** Per-direction prompt: what is shown, and what the learner must produce. */
function dirView(card: ReviewCard): { front: string; frontDe: boolean; expected: string; answerDe: boolean } {
  const v = card.vocabEntry;
  switch (card.direction) {
    case 'RU_TO_DE':
      return { front: v.translationRu, frontDe: false, expected: bareNoun(v.lemma), answerDe: true };
    case 'PRODUCE_ARTICLE':
      return { front: bareNoun(v.lemma), frontDe: true, expected: (v.gender ?? '').toLowerCase(), answerDe: true };
    case 'PRODUCE_PLURAL':
      return { front: withArticle(v), frontDe: true, expected: v.pluralForm ?? '', answerDe: true };
    default: // DE_TO_RU
      return { front: withArticle(v), frontDe: true, expected: v.translationRu, answerDe: false };
  }
}

export default function ReviewPage() {
  const t = useTranslations('review');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => apiGet<{ items: ReviewCard[]; count: number }>('/api/vocabulary/review?limit=30'),
  });

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const current = items[index];
  const view = current ? dirView(current) : null;
  const recallMatch = revealed && typed.trim() !== '' && view ? norm(typed) === norm(view.expected) : false;

  async function grade(g: number) {
    if (!current || busy) return;
    setBusy(true);
    try {
      // postOrQueue advances even offline — the grade is queued and synced later.
      await postOrQueue('/api/vocabulary/review', {
        vocabEntryId: current.vocabEntry.id,
        grade: g,
        direction: current.direction,
      });
      setRevealed(false);
      setTyped('');
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

  const done = !current || !view;

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
              <Link href="/vocabulary" className={cn(buttonVariants({ variant: 'outline' }))}>
                {t('toVocab')}
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
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex items-center gap-2">
                <Badge variant="muted">{current.vocabEntry.pos}</Badge>
                <Badge variant="default">{t(`task_${current.direction}`)}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('font-display text-3xl', view.frontDe && 'de')}>{view.front}</span>
                {view.frontDe && <SpeakButton text={current.vocabEntry.lemma} className="h-6 w-6" />}
              </div>
              {revealed && (
                <div className="flex flex-col items-center gap-1 animate-fade-in">
                  <span className={cn('text-xl font-semibold', view.answerDe && 'de')}>{view.expected || '—'}</span>
                  {typed.trim() !== '' && (
                    <span className={cn('text-xs font-semibold', recallMatch ? 'text-success' : 'text-destructive')}>
                      {recallMatch ? t('recallCorrect') : t('recallWrong', { answer: typed.trim() })}
                    </span>
                  )}
                  <span className="mt-1 text-sm text-muted-foreground">
                    {withArticle(current.vocabEntry)} — {current.vocabEntry.translationRu}
                  </span>
                  <div className="flex gap-2">
                    {current.vocabEntry.pluralForm && <Badge variant="deutsch">pl. {current.vocabEntry.pluralForm}</Badge>}
                    {current.vocabEntry.partizipII && (
                      <Badge variant="deutsch">
                        {current.vocabEntry.auxiliary?.toLowerCase() ?? ''} {current.vocabEntry.partizipII}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-5 w-full">
            {!revealed ? (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setRevealed(true);
                  }}
                  placeholder={t(`hint_${current.direction}`)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-center outline-none focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setRevealed(true)} disabled={!typed.trim()}>
                    {t('check')}
                  </Button>
                  <Button variant="outline" onClick={() => setRevealed(true)}>
                    {t('dontKnow')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
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
