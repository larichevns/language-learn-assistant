'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PartyPopper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { buttonVariants, Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/ui/speak-button';
import { cn } from '@/lib/utils';

interface ReviewCard {
  id: string;
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

export default function ReviewPage() {
  const t = useTranslations('review');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => apiGet<{ items: ReviewCard[]; count: number }>('/api/vocabulary/review?limit=30'),
  });

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const current = items[index];

  async function grade(g: number) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await apiPost('/api/vocabulary/review', { vocabEntryId: current.vocabEntry.id, grade: g });
      setRevealed(false);
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
              <Badge variant="muted">{current.vocabEntry.pos}</Badge>
              <div className="flex items-center gap-2">
                <span className="de font-display text-3xl">
                  {current.vocabEntry.gender ? `${current.vocabEntry.gender.toLowerCase()} ` : ''}
                  {current.vocabEntry.lemma.replace(/^(der|die|das)\s+/i, '')}
                </span>
                <SpeakButton text={current.vocabEntry.lemma} className="h-6 w-6" />
              </div>
              {revealed && (
                <div className="flex flex-col items-center gap-1 animate-fade-in">
                  <span className="text-lg">{current.vocabEntry.translationRu}</span>
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
              <Button className="w-full" onClick={() => setRevealed(true)}>
                {t('showAnswer')}
              </Button>
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
