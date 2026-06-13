'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';

interface NoteRow {
  id: string;
  title?: string | null;
  rawInput: string;
  createdAt: string;
}

export default function NotesPage() {
  const t = useTranslations('notes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['notes'], queryFn: () => apiGet<{ items: NoteRow[] }>('/api/notes?pageSize=100') });
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');

  const create = useMutation({
    mutationFn: () => apiPost<{ id: string }>('/api/notes', { title: title || undefined, rawInput }),
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: ['notes'] });
      router.push(`/notes/${n.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 p-4">
          <Input placeholder={t('titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder={t('textPlaceholder')} rows={4} value={rawInput} onChange={(e) => setRawInput(e.target.value)} />
          <Button className="self-end" disabled={create.isPending || !rawInput.trim()} onClick={() => create.mutate()}>
            {create.isPending ? <Spinner /> : tc('save')}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.items.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <p className="font-medium">{n.title ?? 'Без названия'}</p>
                  <p className="truncate text-sm text-muted-foreground">{n.rawInput.slice(0, 90)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {data && data.items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>}
        </div>
      )}
    </div>
  );
}
