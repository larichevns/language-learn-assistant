'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/feedback';

interface Usage {
  totals: { _count: { _all: number }; _sum: { inputTokens: number | null; outputTokens: number | null; estimatedCostUsd: number | null } };
  byFeature: Array<{ featureSlug: string; _count: { _all: number } }>;
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-usage', 30], queryFn: () => apiGet<Usage>('/api/admin/usage?days=30') });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  const t = data.totals;
  const stats = [
    { label: 'AI-запросов (30д)', value: t._count._all },
    { label: 'Input-токенов', value: (t._sum.inputTokens ?? 0).toLocaleString('ru') },
    { label: 'Output-токенов', value: (t._sum.outputTokens ?? 0).toLocaleString('ru') },
    { label: 'Стоимость, $', value: (t._sum.estimatedCostUsd ?? 0).toFixed(4) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-1 p-4">
              <span className="font-display text-2xl font-bold tabular-nums">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Запросы по фичам (30 дней)</h2>
          <div className="flex flex-col gap-1 text-sm">
            {data.byFeature.map((f) => (
              <div key={f.featureSlug} className="flex justify-between">
                <span className="text-muted-foreground">{f.featureSlug}</span>
                <span className="tabular-nums">{f._count._all}</span>
              </div>
            ))}
            {data.byFeature.length === 0 && <span className="text-muted-foreground">Пока нет данных.</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
