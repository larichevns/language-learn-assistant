'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import { useScope } from '@/components/assistant/use-scope';
import { useDock } from '@/lib/stores/dock';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';

interface Structured {
  newVocab?: Array<{ lemma: string; translationRu?: string }>;
  grammarPoints?: string[];
  todos?: string[];
}
interface Note {
  id: string;
  title?: string | null;
  rawInput: string;
  structuredJson?: Structured | null;
}

export default function NoteDetailPage() {
  const id = String(useParams().id);
  const t = useTranslations('notes');
  const openDock = useDock((s) => s.openWindow);
  const { data, isLoading } = useQuery({ queryKey: ['notes', id], queryFn: () => apiGet<Note>(`/api/notes/${id}`) });
  useScope({ type: 'CLASS_NOTE', id, label: data?.title ?? t('fallbackTitle') });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  const s = data.structuredJson;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/notes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('allNotes')}
      </Link>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{data.title ?? t('fallbackTitle')}</h1>
        <Button variant="outline" className="gap-2" onClick={openDock}>
          <Sparkles className="h-4 w-4 text-primary" /> {t('parse')}
        </Button>
      </div>

      <Card className="mb-5">
        <CardContent className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{data.rawInput}</CardContent>
      </Card>

      {s && (s.newVocab?.length || s.grammarPoints?.length || s.todos?.length) ? (
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
      )}
    </div>
  );
}
