'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiGet, apiFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';

interface Limit {
  id: string;
  tier: string;
  operationType: string;
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
}

export default function AdminRateLimitsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-limits'], queryFn: () => apiGet<Limit[]>('/api/admin/rate-limits') });
  const [draft, setDraft] = useState<Record<string, Limit>>({});

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.map((l) => [l.id, l])));
  }, [data]);

  const save = useMutation({
    mutationFn: (l: Limit) =>
      apiFetch('/api/admin/rate-limits', {
        method: 'PUT',
        body: JSON.stringify({
          tier: l.tier,
          operationType: l.operationType,
          maxRequestsPerMinute: l.maxRequestsPerMinute,
          maxRequestsPerDay: l.maxRequestsPerDay,
          maxTokensPerDay: l.maxTokensPerDay,
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-limits'] }),
  });

  const set = (id: string, key: keyof Limit, value: number) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id]!, [key]: value } }));

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((l) => {
        const row = draft[l.id] ?? l;
        return (
          <Card key={l.id}>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="font-medium">
                {l.tier} <span className="text-xs text-muted-foreground">/ {l.operationType}</span>
              </div>
              <Field label="rpm" value={row.maxRequestsPerMinute} onChange={(v) => set(l.id, 'maxRequestsPerMinute', v)} />
              <Field label="rpd" value={row.maxRequestsPerDay} onChange={(v) => set(l.id, 'maxRequestsPerDay', v)} />
              <Field label="tok/день" value={row.maxTokensPerDay} onChange={(v) => set(l.id, 'maxTokensPerDay', v)} />
              <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(row)}>
                Сохранить
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Input type="number" className="w-28" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}
