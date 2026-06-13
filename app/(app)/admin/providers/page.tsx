'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';

interface Provider {
  id: string;
  slug: string;
  displayName: string;
  isEnabled: boolean;
  healthStatus: string;
  hasKey: boolean;
  models: Array<{ id: string; modelId: string; isEnabled: boolean }>;
}

export default function AdminProvidersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-providers'], queryFn: () => apiGet<Provider[]>('/api/admin/providers') });

  const test = useMutation({
    mutationFn: (id: string) => apiPost(`/api/admin/providers/${id}/test`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-providers'] }),
  });
  const refresh = useMutation({
    mutationFn: (id: string) => apiPost(`/api/admin/providers/${id}/refresh-models`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-providers'] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  const healthVariant = (h: string) => (h === 'up' ? 'success' : h === 'down' ? 'muted' : 'secondary');

  return (
    <div className="flex flex-col gap-3">
      {data.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.displayName}</span>
                <Badge variant="muted">{p.slug}</Badge>
                <Badge variant={p.isEnabled ? 'success' : 'secondary'}>{p.isEnabled ? 'вкл' : 'выкл'}</Badge>
                <Badge variant={healthVariant(p.healthStatus)}>{p.healthStatus}</Badge>
                {p.hasKey && <Badge variant="default">ключ</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate(p.id)}>
                  Тест
                </Button>
                <Button size="sm" variant="ghost" disabled={refresh.isPending} onClick={() => refresh.mutate(p.id)}>
                  Обновить модели
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.models.map((m) => (
                <Badge key={m.id} variant={m.isEnabled ? 'default' : 'muted'}>
                  {m.modelId}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
