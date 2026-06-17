'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { ProposalCard } from '@/components/assistant/proposal-card';
import type { ChatProposal } from '@/lib/ai-client/chat-stream';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';

interface Correction {
  original: string;
  corrected: string;
  errorType: string;
  explanationRu: string;
  case?: string | null;
  gender?: string | null;
}
interface Homework {
  id: string;
  title?: string | null;
  rawInput: string;
  source?: string;
  imageUrl?: string | null;
  status: string;
  correctionsJson?: Correction[] | null;
}

export default function HomeworkDetailPage() {
  const id = String(useParams().id);
  const t = useTranslations('homework');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['homework', id], queryFn: () => apiGet<Homework>(`/api/homework/${id}`) });
  const [proposals, setProposals] = useState<ChatProposal[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const correct = useMutation({
    mutationFn: () => apiPost<{ text: string; proposals: ChatProposal[] }>(`/api/homework/${id}/correct`),
    onSuccess: (res) => {
      setProposals(res.proposals);
      setNote(res.text);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/homework" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('allHomework')}
      </Link>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 font-display text-2xl font-bold">{data.title ?? t('fallbackTitle')}</h1>
        <Button onClick={() => correct.mutate()} disabled={correct.isPending} className="gap-2">
          {correct.isPending ? <Spinner /> : <Wand2 className="h-4 w-4" />} {t('check')}
        </Button>
      </div>

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-3 p-4">
          {data.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageUrl} alt={t('photoAlt')} className="max-h-80 max-w-full self-start rounded-lg border border-border object-contain" />
          )}
          {data.rawInput && data.rawInput !== '(фото-домашка)' && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.rawInput}</p>
          )}
        </CardContent>
      </Card>

      {note && <p className="mb-3 text-sm text-muted-foreground">{note}</p>}

      {proposals.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('suggested')}</h2>
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onResolved={() => void qc.invalidateQueries({ queryKey: ['homework', id] })} />
          ))}
        </div>
      )}

      {data.correctionsJson && data.correctionsJson.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t('corrections')}</h2>
          {data.correctionsJson.map((c, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-1 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{c.errorType}</Badge>
                  {c.case && <Badge variant="deutsch">{c.case}</Badge>}
                </div>
                <p>
                  <span className="text-destructive line-through">{c.original}</span> →{' '}
                  <span className="de text-success">{c.corrected}</span>
                </p>
                <p className="text-muted-foreground">{c.explanationRu}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
