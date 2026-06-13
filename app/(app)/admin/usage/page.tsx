'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';

interface UsageResp {
  byModel: Array<{ modelId: string | null; _count: { _all: number }; _sum: { estimatedCostUsd: number | null } }>;
  recentErrors: Array<{ id: string; featureSlug: string; modelId: string | null; errorMessage: string | null; createdAt: string }>;
}

export default function AdminUsagePage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-usage-detail'], queryFn: () => apiGet<UsageResp>('/api/admin/usage?days=30') });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">По моделям (30 дней)</h2>
          <div className="flex flex-col gap-1 text-sm">
            {data.byModel.map((m) => (
              <div key={m.modelId ?? 'unknown'} className="flex justify-between">
                <span className="text-muted-foreground">{m.modelId ?? '—'}</span>
                <span className="tabular-nums">
                  {m._count._all} · ${(m._sum.estimatedCostUsd ?? 0).toFixed(4)}
                </span>
              </div>
            ))}
            {data.byModel.length === 0 && <span className="text-muted-foreground">Нет данных.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Последние ошибки</h2>
          <div className="flex flex-col gap-2 text-sm">
            {data.recentErrors.map((e) => (
              <div key={e.id} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{e.featureSlug}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString('ru')}</span>
                </div>
                <span className="text-destructive">{e.errorMessage}</span>
              </div>
            ))}
            {data.recentErrors.length === 0 && <span className="text-muted-foreground">Ошибок нет 🎉</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
