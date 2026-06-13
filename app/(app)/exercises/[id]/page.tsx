'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

interface Item {
  id: string;
  type: string;
  prompt: string;
  optionsJson?: string[] | null;
  answer: string;
  userAnswer?: string | null;
  isCorrect?: boolean | null;
  feedbackRu?: string | null;
}
interface ExSet {
  id: string;
  title: string;
  status: string;
  score?: number | null;
  items: Item[];
}

export default function ExerciseDetailPage() {
  const id = String(useParams().id);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['exercise', id], queryFn: () => apiGet<ExSet>(`/api/exercises/${id}`) });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      apiPost<{ score: number }>(`/api/exercises/${id}/grade`, {
        answers: Object.entries(answers).map(([itemId, userAnswer]) => ({ itemId, userAnswer })),
      }),
    onSuccess: async () => {
      setGraded(true);
      await refetch();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  const isGraded = graded || data.status === 'GRADED';

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link href="/exercises" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Все упражнения
      </Link>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">{data.title}</h1>
        {isGraded && data.score != null && <Badge variant="success">{Math.round(data.score * 100)}%</Badge>}
      </div>

      <div className="flex flex-col gap-3">
        {data.items.map((item, i) => {
          const correct = item.isCorrect;
          return (
            <Card key={item.id} className={isGraded ? (correct ? 'border-success/40' : 'border-destructive/40') : ''}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{i + 1}.</span>
                  <span className="de text-sm">{item.prompt}</span>
                </div>

                {item.optionsJson && item.optionsJson.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.optionsJson.map((opt) => (
                      <button
                        key={opt}
                        disabled={isGraded}
                        onClick={() => setAnswers((a) => ({ ...a, [item.id]: opt }))}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                          (isGraded ? item.userAnswer : answers[item.id]) === opt
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-accent',
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    disabled={isGraded}
                    placeholder="ответ"
                    value={isGraded ? (item.userAnswer ?? '') : (answers[item.id] ?? '')}
                    onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))}
                  />
                )}

                {isGraded && (
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-1.5">
                      {correct ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                      <span className="de">{item.answer}</span>
                    </div>
                    {item.feedbackRu && <span className="text-muted-foreground">{item.feedbackRu}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isGraded && (
        <Button className="mt-4 w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? <Spinner /> : 'Проверить'}
        </Button>
      )}
    </div>
  );
}
