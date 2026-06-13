'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

interface GrammarRow {
  id: string;
  title: string;
  category: string;
  cefrLevel?: string | null;
  masteryScore: number;
}

export default function GrammarPage() {
  const t = useTranslations('grammar');
  const { data, isLoading } = useQuery({
    queryKey: ['grammar'],
    queryFn: () => apiGet<{ items: GrammarRow[]; total: number }>('/api/grammar?pageSize=100'),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { count: data?.total ?? 0 })}</p>
        </div>
        <Link href="/grammar/review" className={cn(buttonVariants())}>
          {t('review')}
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.items.map((g) => (
            <Link key={g.id} href={`/grammar/${g.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display font-semibold leading-tight">{g.title}</span>
                    {g.cefrLevel && <Badge variant="muted">{g.cefrLevel}</Badge>}
                  </div>
                  <Badge variant="secondary" className="self-start">
                    {g.category}
                  </Badge>
                  <div className="mt-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(g.masteryScore * 100)}%` }} />
                    </div>
                    <span className="mt-1 block text-xs text-muted-foreground">{t('mastery', { pct: Math.round(g.masteryScore * 100) })}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {data && data.items.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
