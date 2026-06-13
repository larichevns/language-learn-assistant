'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { buttonVariants, Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/ui/speak-button';
import { cn } from '@/lib/utils';

interface VocabRow {
  id: string;
  lemma: string;
  pos: string;
  translationRu: string;
  gender?: string | null;
  pluralForm?: string | null;
  cefrLevel?: string | null;
  srsCard?: { state: string; dueAt: string } | null;
}
interface ListResp {
  items: VocabRow[];
  total: number;
}

const POS = ['NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PHRASE'];

export default function VocabularyPage() {
  const t = useTranslations('vocab');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['vocab'], queryFn: () => apiGet<ListResp>('/api/vocabulary?pageSize=200') });

  const [lemma, setLemma] = useState('');
  const [pos, setPos] = useState('NOUN');
  const [translationRu, setTranslationRu] = useState('');

  const add = useMutation({
    mutationFn: () => apiPost('/api/vocabulary', { lemma, pos, translationRu }),
    onSuccess: () => {
      setLemma('');
      setTranslationRu('');
      void qc.invalidateQueries({ queryKey: ['vocab'] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('count', { count: data?.total ?? 0 })}</p>
        </div>
        <Link href="/vocabulary/review" className={cn(buttonVariants(), 'gap-2')}>
          <Brain className="h-4 w-4" /> {t('review')}
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (lemma.trim() && translationRu.trim()) add.mutate();
            }}
          >
            <Input className="w-44" placeholder={t('wordPlaceholder')} value={lemma} onChange={(e) => setLemma(e.target.value)} />
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={pos}
              onChange={(e) => setPos(e.target.value)}
            >
              {POS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Input className="w-44" placeholder={t('translationPlaceholder')} value={translationRu} onChange={(e) => setTranslationRu(e.target.value)} />
            <Button type="submit" disabled={add.isPending} className="gap-1.5">
              {add.isPending ? <Spinner /> : <Plus className="h-4 w-4" />} {tc('add')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('hint')}</span>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((v) => {
            const dueNow = v.srsCard ? new Date(v.srsCard.dueAt) <= new Date() : false;
            return (
              <Card key={v.id}>
                <CardContent className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="de font-display text-lg">
                        {v.gender ? `${v.gender.toLowerCase()} ` : ''}
                        {v.lemma.replace(/^(der|die|das)\s+/i, '')}
                      </span>
                      <SpeakButton text={v.lemma} />
                    </div>
                    {v.cefrLevel && <Badge variant="muted">{v.cefrLevel}</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground">{v.translationRu}</span>
                  <div className="mt-1 flex items-center gap-2">
                    {v.pluralForm && <Badge variant="deutsch">pl. {v.pluralForm}</Badge>}
                    {dueNow && <Badge variant="default">{t('dueBadge')}</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {data && data.items.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
