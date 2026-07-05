'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useGroupCollapse } from '@/components/groups/use-collapse';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { SearchInput } from '@/components/ui/search-input';
import { SortToggle } from '@/components/ui/sort-toggle';
import { Composer } from '@/components/writing/composer';
import { EntryDateInput } from '@/components/writing/entry-date-input';
import { apiGet, apiPost } from '@/lib/api/client';

interface HwRow {
  id: string;
  title?: string | null;
  rawInput: string;
  status: string;
  entryDate: string;
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
  const format = useFormatter();
  return (
    <Link href={`/homework/${hw.id}`}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{hw.title ?? 'Без названия'}</p>
            <p className="text-xs text-muted-foreground">
              {format.dateTime(new Date(hw.entryDate), { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
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
  const [draftEntryDate, setDraftEntryDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'recent' | 'entryDate'>('recent');
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
      apiPost<{ id: string }>('/api/homework', {
        title: title || undefined,
        ...(imageDataUrl ? { imageUrl: imageDataUrl, source: 'IMAGE' } : { rawInput }),
        ...(draftEntryDate ? { entryDate: draftEntryDate } : {}),
      }),
    onSuccess: (hw) => {
      setDraftEntryDate(null);
      void qc.invalidateQueries({ queryKey: ['homework'] });
      router.push(`/homework/${hw.id}`);
    },
  });

  const canSubmit = Boolean(rawInput.trim()) || Boolean(imageDataUrl);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!q) return items;
    return items.filter(
      (hw) => (hw.title ?? '').toLowerCase().includes(q) || hw.rawInput.toLowerCase().includes(q),
    );
  }, [data, search]);

  const sortedItems = useMemo(() => {
    if (sortMode === 'recent') return filteredItems;
    return [...filteredItems].sort((a, b) => Date.parse(b.entryDate) - Date.parse(a.entryDate));
  }, [filteredItems, sortMode]);

  // Bucket the rows by status; keep only the non-empty buckets.
  const buckets = useMemo(() => {
    return BUCKETS.map((b) => ({ ...b, items: sortedItems.filter((hw) => b.statuses.includes(hw.status)) })).filter(
      (b) => b.items.length > 0,
    );
  }, [sortedItems]);

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
              <EntryDateInput value={draftEntryDate} onChange={setDraftEntryDate} label={tc('entryDate')} />
            </div>
          }
        >
          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="предпросмотр" className="max-h-48 max-w-full rounded-lg border border-border object-contain" />
          )}
        </Composer>
      </div>

      {(data?.items?.length ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} clearLabel={tc('clearSearch')} />
          </div>
          <SortToggle
            mode={sortMode}
            onChange={setSortMode}
            recentLabel={tc('sortRecent')}
            dateLabel={tc('sortByDate')}
          />
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
