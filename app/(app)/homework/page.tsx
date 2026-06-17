'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useGroupCollapse } from '@/components/groups/use-collapse';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { Composer } from '@/components/writing/composer';
import { apiGet, apiPost } from '@/lib/api/client';

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

// Derived buckets: homework has no group taxonomy, so we present it grouped by
// its `status` lifecycle. Presentation only — no move, no CRUD, no AI.
const BUCKETS: Array<{ key: string; labelKey: string; statuses: string[] }> = [
  { key: 'review', labelKey: 'bucketReview', statuses: ['SUBMITTED', 'STRUCTURED'] },
  { key: 'corrected', labelKey: 'bucketCorrected', statuses: ['CORRECTED'] },
  { key: 'drafts', labelKey: 'bucketDrafts', statuses: ['DRAFT'] },
  { key: 'archive', labelKey: 'bucketArchive', statuses: ['ARCHIVED'] },
];

function HwCard({ hw }: { hw: HwRow }) {
  return (
    <Link href={`/homework/${hw.id}`}>
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
  );
}

export default function HomeworkPage() {
  const t = useTranslations('homework');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['homework'], queryFn: () => apiGet<{ items: HwRow[] }>('/api/homework?pageSize=100') });

  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useGroupCollapse('lla:homework:open-buckets');

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

  // Bucket the rows by status; keep only the non-empty buckets.
  const buckets = useMemo(() => {
    const items = data?.items ?? [];
    return BUCKETS.map((b) => ({ ...b, items: items.filter((hw) => b.statuses.includes(hw.status)) })).filter(
      (b) => b.items.length > 0,
    );
  }, [data]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mb-6">
        <Composer
          title={title}
          onTitleChange={setTitle}
          titlePlaceholder={t('titlePlaceholder')}
          value={rawInput}
          onChange={setRawInput}
          placeholder={t('textPlaceholder')}
          onSubmit={() => create.mutate()}
          submitLabel={tc('save')}
          submitting={create.isPending}
          submitDisabled={!canSubmit}
          footerLeft={
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                {imageDataUrl ? t('photoSelected') : t('photo')}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
              {imageDataUrl && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setImageDataUrl(null)}
                >
                  {tc('remove')}
                </button>
              )}
            </div>
          }
        >
          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="предпросмотр" className="max-h-48 max-w-full rounded-lg border border-border object-contain" />
          )}
        </Composer>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-primary" />
        </div>
      ) : buckets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <Accordion type="multiple" value={open} onValueChange={setOpen} className="flex flex-col gap-2">
          {buckets.map((b) => (
            <AccordionItem key={b.key} value={b.key} className="border-b-0">
              <AccordionTrigger className="border-b border-border py-3 font-display text-base font-semibold no-underline hover:no-underline">
                <span className="flex items-baseline gap-2">
                  {t(b.labelKey)}
                  <span className="text-sm font-normal text-muted-foreground">{b.items.length}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-2 pb-4 pt-3">
                {b.items.map((hw) => (
                  <HwCard key={hw.id} hw={hw} />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
