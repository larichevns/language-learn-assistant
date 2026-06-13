'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';

interface AbuseRow {
  id: string;
  severity: string;
  featureSlug: string | null;
  rulesJson: string[];
  contentPreview: string;
  createdAt: string;
  user: { id: string; email: string | null } | null;
}

export default function AdminModerationPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-moderation'], queryFn: () => apiGet<{ items: AbuseRow[] }>('/api/admin/moderation?pageSize=100') });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Срабатываний нет 🎉</p>}
      {data.items.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex flex-col gap-1 p-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={a.severity === 'block' ? 'muted' : 'secondary'}>{a.severity}</Badge>
              {a.featureSlug && <Badge variant="muted">{a.featureSlug}</Badge>}
              <span className="text-xs text-muted-foreground">{a.user?.email ?? '—'}</span>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString('ru')}</span>
            </div>
            <span className="text-muted-foreground">правила: {a.rulesJson.join(', ')}</span>
            <span className="font-mono text-xs">{a.contentPreview}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
