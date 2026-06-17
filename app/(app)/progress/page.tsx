'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, Flame, GraduationCap, History, Sparkles, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { apiGet } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

interface Stats {
  trueRetention: number | null;
  retentionSample: number;
  mature: number;
  young: number;
  totalCards: number;
  reviews30: number;
  gradeable30: number;
  accuracy30: number | null;
  streakDays: number;
  wordsByCefr: Array<{ cefr: string; count: number }>;
  errorsByCategory: Array<{ category: string; count: number }>;
  weeklyNote: string | null;
  weeklyNoteAt: string | null;
}
interface Ev {
  id: string;
  type: string;
  payloadJson: Record<string, unknown> | null;
  occurredAt: string;
}

const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);

function StatCard({ icon, value, label, hint }: { icon: ReactNode; value: string; label: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <span className="font-display text-2xl font-bold leading-tight">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint ? <span className="text-[10px] text-muted-foreground/70">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

function Bar({ label, count, max, danger }: { label: string; count: number; max: number; danger?: boolean }) {
  const w = Math.round((count / max) * 100);
  return (
    <div className="mb-2 flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 truncate text-muted-foreground sm:w-32">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div className={cn('h-2 rounded-full', danger ? 'bg-destructive' : 'bg-primary')} style={{ width: `${Math.max(6, w)}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right font-semibold">{count}</span>
    </div>
  );
}

export default function ProgressPage() {
  const t = useTranslations('progress');
  const { data: stats, isLoading } = useQuery({
    queryKey: ['progress-stats'],
    queryFn: () => apiGet<Stats>('/api/progress/stats'),
  });
  const { data: tl } = useQuery({
    queryKey: ['progress-timeline'],
    queryFn: () => apiGet<{ items: Ev[] }>('/api/progress/timeline?limit=50'),
  });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-primary" />
      </div>
    );
  }

  function evText(ev: Ev): string {
    const p = ev.payloadJson ?? {};
    switch (ev.type) {
      case 'CARD_MATURED':
        return t('evCardMatured', { lemma: String(p.lemma ?? '') });
      case 'HOMEWORK_CORRECTED':
        return t('evHomeworkCorrected', { count: Number(p.corrections ?? 0) });
      case 'WEAK_AREA_CLEARED':
        return t('evWeakCleared', { topic: String(p.topic ?? '') });
      case 'CEFR_CHANGED':
        return t('evCefrChanged', { level: String(p.level ?? '') });
      case 'STREAK_MILESTONE':
        return t('evStreak', { days: Number(p.days ?? 0) });
      case 'UNIT_COMPLETED':
        return t('evUnitCompleted', { title: String(p.title ?? '') });
      default:
        return ev.type;
    }
  }

  const maxCefr = Math.max(1, ...stats.wordsByCefr.map((w) => w.count));
  const maxErr = Math.max(1, ...stats.errorsByCategory.map((e) => e.count));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      {stats.weeklyNote ? (
        <Card className="mb-5 border-primary/30 bg-primary/5">
          <CardContent className="flex gap-3 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="mb-1 text-sm font-semibold">{t('weeklyNote')}</h2>
              <p className="text-sm leading-relaxed text-foreground/90">{stats.weeklyNote}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Target />}
          value={pct(stats.trueRetention)}
          label={t('retention')}
          hint={t('retentionSample', { n: stats.retentionSample })}
        />
        <StatCard icon={<Flame />} value={t('streakValue', { days: stats.streakDays })} label={t('streak')} />
        <StatCard icon={<GraduationCap />} value={`${stats.mature} / ${stats.young}`} label={t('matureYoung')} />
        <StatCard icon={<BookOpen />} value={String(stats.totalCards)} label={t('cards')} hint={t('reviews30', { n: stats.reviews30 })} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{t('byCefr')}</h2>
            {stats.wordsByCefr.length ? (
              stats.wordsByCefr.map((w) => <Bar key={w.cefr} label={w.cefr} count={w.count} max={maxCefr} />)
            ) : (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{t('errors30')}</h2>
            {stats.errorsByCategory.length ? (
              stats.errorsByCategory.map((e) => <Bar key={e.category} label={e.category} count={e.count} max={maxErr} danger />)
            ) : (
              <p className="text-sm text-muted-foreground">{t('noErrors')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardContent className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary" />
            {t('journal')}
          </h2>
          {tl?.items?.length ? (
            <ul className="flex flex-col gap-2">
              {tl.items.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg bg-accent/50 px-3 py-2 text-sm">
                  <span className="min-w-0">{evText(ev)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(ev.occurredAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('journalEmpty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
