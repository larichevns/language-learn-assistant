'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet } from '@/lib/api/client';
import { useScope } from '@/components/assistant/use-scope';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/ui/speak-button';

interface GrammarTopic {
  id: string;
  title: string;
  category: string;
  cefrLevel?: string | null;
  explanationRu: string;
  examplesJson?: Array<{ de: string; ru: string; highlight?: string }> | null;
  rulesJson?: Array<{ rule: string; examples?: string[] }> | null;
  pitfallsJson?: string[] | null;
  masteryScore: number;
}

export default function GrammarDetailPage() {
  const id = String(useParams().id);
  const { data, isLoading } = useQuery({ queryKey: ['grammar', id], queryFn: () => apiGet<GrammarTopic>(`/api/grammar/${id}`) });
  useScope({ type: 'GRAMMAR_TOPIC', id, label: data?.title ?? 'Грамматика' });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/grammar" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Все темы
      </Link>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="font-display text-2xl font-bold">{data.title}</h1>
        {data.cefrLevel && <Badge variant="muted">{data.cefrLevel}</Badge>}
      </div>

      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="space-y-2 text-sm leading-relaxed [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.explanationRu}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {data.examplesJson && data.examplesJson.length > 0 && (
        <Card className="mb-4">
          <CardContent className="flex flex-col gap-2 p-5">
            <h2 className="text-sm font-semibold">Примеры</h2>
            {data.examplesJson.map((ex, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <SpeakButton text={ex.de} />
                <span className="de">{ex.de}</span> — <span className="text-muted-foreground">{ex.ru}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.pitfallsJson && data.pitfallsJson.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1 p-5">
            <h2 className="text-sm font-semibold">Подводные камни</h2>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {data.pitfallsJson.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
