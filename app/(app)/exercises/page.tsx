'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { ProposalCard } from '@/components/assistant/proposal-card';
import type { ChatProposal } from '@/lib/ai-client/chat-stream';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';

interface SetRow {
  id: string;
  title: string;
  status: string;
  score?: number | null;
  _count?: { items: number };
}
interface GrammarRow {
  id: string;
  title: string;
}

export default function ExercisesPage() {
  const t = useTranslations('exercises');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['exercises'], queryFn: () => apiGet<{ items: SetRow[] }>('/api/exercises?pageSize=100') });
  const grammar = useQuery({ queryKey: ['grammar'], queryFn: () => apiGet<{ items: GrammarRow[] }>('/api/grammar?pageSize=100') });

  const [count, setCount] = useState(5);
  const [grammarTopicId, setGrammarTopicId] = useState('');
  const [proposals, setProposals] = useState<ChatProposal[]>([]);

  const generate = useMutation({
    mutationFn: () => apiPost<{ proposals: ChatProposal[] }>('/api/exercises/generate', { count, grammarTopicId: grammarTopicId || undefined }),
    onSuccess: (res) => setProposals(res.proposals),
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={grammarTopicId} onChange={(e) => setGrammarTopicId(e.target.value)}>
            <option value="">{t('byCurrentUnit')}</option>
            {grammar.data?.items.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <Input type="number" min={1} max={20} className="w-20" value={count} onChange={(e) => setCount(Number(e.target.value) || 5)} />
          <Button className="gap-2" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <Spinner /> : <Sparkles className="h-4 w-4" />} {t('generate')}
          </Button>
        </CardContent>
      </Card>

      {proposals.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onResolved={() => void qc.invalidateQueries({ queryKey: ['exercises'] })} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.items.map((s) => (
            <Link key={s.id} href={`/exercises/${s.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{t('tasks', { count: s._count?.items ?? 0 })}</p>
                  </div>
                  {s.status === 'GRADED' && s.score != null ? (
                    <Badge variant="success">{Math.round(s.score * 100)}%</Badge>
                  ) : (
                    <Badge variant="muted">{t('take')}</Badge>
                  )}
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
