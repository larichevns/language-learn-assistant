'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';
import { ApiClientError, apiPost } from '@/lib/api/client';

const POS = ['NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PHRASE'];

/** Manual add — no group selection; the new word lands ungrouped by design. */
export function AddWordForm() {
  const t = useTranslations('vocab');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [lemma, setLemma] = useState('');
  const [pos, setPos] = useState('NOUN');
  const [translationRu, setTranslationRu] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => apiPost('/api/vocabulary', { lemma, pos, translationRu }),
    onSuccess: () => {
      setError(null);
      setLemma('');
      setTranslationRu('');
      void qc.invalidateQueries({ queryKey: ['vocab'] });
    },
    onError: (e) => setError(e instanceof ApiClientError ? e.message : t('saveError')),
  });

  return (
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
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
