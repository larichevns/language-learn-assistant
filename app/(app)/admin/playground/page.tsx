'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';

interface Feature {
  id: string;
  slug: string;
}
interface PlaygroundResp {
  text: string;
  toolCalls: Array<{ name: string; args: unknown }>;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  modelId: string;
}

export default function AdminPlaygroundPage() {
  const features = useQuery({ queryKey: ['admin-features'], queryFn: () => apiGet<Feature[]>('/api/admin/features') });
  const [featureSlug, setFeatureSlug] = useState('tutor_chat');
  const [message, setMessage] = useState('Объясни Akkusativ кратко.');
  const [withTools, setWithTools] = useState(false);

  const run = useMutation({
    mutationFn: () => apiPost<PlaygroundResp>('/api/admin/playground', { featureSlug, message, withTools }),
  });

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={featureSlug} onChange={(e) => setFeatureSlug(e.target.value)}>
              {features.data?.map((f) => (
                <option key={f.id} value={f.slug}>
                  {f.slug}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={withTools} onChange={(e) => setWithTools(e.target.checked)} /> с инструментом propose
            </label>
          </div>
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button className="self-end" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Spinner /> : 'Запустить'}
          </Button>
        </CardContent>
      </Card>

      {run.data && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4 text-sm">
            <span className="text-xs text-muted-foreground">
              {run.data.modelId} · in {run.data.usage.inputTokens} / out {run.data.usage.outputTokens}
            </span>
            <p className="whitespace-pre-wrap leading-relaxed">{run.data.text}</p>
            {run.data.toolCalls.length > 0 && (
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-[11px]">
                {JSON.stringify(run.data.toolCalls, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
      {run.isError && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
    </div>
  );
}
