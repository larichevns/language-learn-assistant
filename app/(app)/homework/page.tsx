'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';

interface HwRow {
  id: string;
  title?: string | null;
  rawInput: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'черновик',
  SUBMITTED: 'отправлено',
  STRUCTURED: 'разобрано',
  CORRECTED: 'исправлено',
  ARCHIVED: 'архив',
};

export default function HomeworkPage() {
  const t = useTranslations('homework');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['homework'], queryFn: () => apiGet<{ items: HwRow[] }>('/api/homework?pageSize=100') });

  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>(
        '/api/homework',
        imageDataUrl
          ? { title: title || undefined, imageUrl: imageDataUrl, source: 'IMAGE' }
          : { title: title || undefined, rawInput },
      ),
    onSuccess: (hw) => {
      void qc.invalidateQueries({ queryKey: ['homework'] });
      router.push(`/homework/${hw.id}`);
    },
  });

  const canSubmit = Boolean(rawInput.trim()) || Boolean(imageDataUrl);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 p-4">
          <Input placeholder={t('titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder={t('textPlaceholder')}
            rows={5}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              {imageDataUrl ? t('photoSelected') : t('photo')}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            {imageDataUrl && (
              <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setImageDataUrl(null)}>
                {tc('remove')}
              </button>
            )}
            <Button className="ml-auto" disabled={create.isPending || !canSubmit} onClick={() => create.mutate()}>
              {create.isPending ? <Spinner /> : tc('save')}
            </Button>
          </div>
          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="предпросмотр" className="max-h-48 self-start rounded-lg border border-border object-contain" />
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.items.map((hw) => (
            <Link key={hw.id} href={`/homework/${hw.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{hw.title ?? 'Без названия'}</p>
                    <p className="truncate text-sm text-muted-foreground">{hw.rawInput.slice(0, 80)}</p>
                  </div>
                  <Badge variant={hw.status === 'CORRECTED' ? 'success' : 'muted'}>{STATUS_LABEL[hw.status] ?? hw.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
          {data && data.items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
