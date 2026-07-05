'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Send, Sparkles } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiClientError, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { useScope } from '@/components/assistant/use-scope';
import { useDock } from '@/lib/stores/dock';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { Composer } from '@/components/writing/composer';
import { EntryDateInput } from '@/components/writing/entry-date-input';
import { MarkdownView } from '@/components/writing/markdown-view';

interface Structured {
  newVocab?: Array<{ lemma: string; translationRu?: string }>;
  grammarPoints?: string[];
  todos?: string[];
}
interface Note {
  id: string;
  title?: string | null;
  rawInput: string;
  entryDate: string;
  structuredJson?: Structured | null;
}

export default function NoteDetailPage() {
  const id = String(useParams().id);
  const t = useTranslations('notes');
  const tc = useTranslations('common');
  const tg = useTranslations('group');
  const format = useFormatter();
  const qc = useQueryClient();
  const router = useRouter();
  const openDock = useDock((s) => s.openWindow);
  const { data, isLoading } = useQuery({ queryKey: ['notes', id], queryFn: () => apiGet<Note>(`/api/notes/${id}`) });
  useScope({ type: 'CLASS_NOTE', id, label: data?.title ?? t('fallbackTitle') });

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftEntryDate, setDraftEntryDate] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiPatch<Note>(`/api/notes/${id}`, {
        title: draftTitle.trim() || null,
        rawInput: draftBody,
        entryDate: draftEntryDate,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notes', id] });
      void qc.invalidateQueries({ queryKey: ['notes'] });
      setEditing(false);
    },
  });

  const promote = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/api/homework', {
        title: data?.title ?? undefined,
        rawInput: data?.rawInput,
        entryDate: data?.entryDate,
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['homework'] });
      router.push(`/homework/${created.id}`);
    },
    onError: (e) => setPromoteError(e instanceof ApiClientError ? e.message : tg('genericError')),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  const s = data.structuredJson;

  const startEdit = () => {
    setDraftTitle(data.title ?? '');
    setDraftBody(data.rawInput);
    setDraftEntryDate(data.entryDate);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
  };
  const doPromote = () => {
    if (!data.rawInput.trim() || promote.isPending) return;
    setPromoteError(null);
    promote.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/notes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('allNotes')}
      </Link>

      {editing ? (
        <div className="mb-5 flex flex-col gap-3">
          <Composer
            title={draftTitle}
            onTitleChange={setDraftTitle}
            titlePlaceholder={t('titlePlaceholder')}
            value={draftBody}
            onChange={setDraftBody}
            placeholder={t('textPlaceholder')}
            german
            hint={t('markdownHint')}
            footerLeft={<EntryDateInput value={draftEntryDate} onChange={setDraftEntryDate} label={tc('entryDate')} />}
            onSubmit={() => save.mutate()}
            submitLabel={tc('save')}
            submitting={save.isPending}
            submitDisabled={save.isPending || !draftBody.trim()}
          />
          <div className="flex justify-end">
            <Button variant="ghost" onClick={cancelEdit} disabled={save.isPending}>
              {tc('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 font-display text-2xl font-bold">{data.title ?? t('fallbackTitle')}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={startEdit}>
                <Pencil className="h-4 w-4" /> {t('edit')}
              </Button>
              <Button variant="outline" className="gap-2" onClick={openDock}>
                <Sparkles className="h-4 w-4 text-primary" /> {t('parse')}
              </Button>
              <Button variant="outline" className="gap-2" onClick={doPromote} disabled={promote.isPending || !data.rawInput.trim()}>
                {promote.isPending ? <Spinner /> : <Send className="h-4 w-4" />} {t('sendToHomework')}
              </Button>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {format.dateTime(new Date(data.entryDate), { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {promoteError && <p className="mb-4 text-sm text-destructive">{promoteError}</p>}

          <Card className="mb-5">
            <CardContent className="p-4">
              <MarkdownView>{data.rawInput}</MarkdownView>
            </CardContent>
          </Card>
        </>
      )}

      {!editing && (s && (s.newVocab?.length || s.grammarPoints?.length || s.todos?.length) ? (
        <div className="flex flex-col gap-3">
          {s.newVocab && s.newVocab.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold">{t('newWords')}</h2>
                <div className="flex flex-wrap gap-2">
                  {s.newVocab.map((v, i) => (
                    <Badge key={i} variant="deutsch">
                      {v.lemma}
                      {v.translationRu ? ` — ${v.translationRu}` : ''}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {s.grammarPoints && s.grammarPoints.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold">{t('grammar')}</h2>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {s.grammarPoints.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('parseHint')}</p>
      ))}
    </div>
  );
}
