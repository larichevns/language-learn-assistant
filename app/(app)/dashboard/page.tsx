import { BookOpen, Brain, NotebookPen, SpellCheck2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const t = await getTranslations('dashboard');

  const now = new Date();
  const [vocabDue, grammarDue, vocab, grammar, homework, profile, retPass, retTotal] = await Promise.all([
    prisma.srsCard.count({ where: { userId, dueAt: { lte: now }, state: { not: 'SUSPENDED' } } }),
    prisma.grammarCard.count({ where: { userId, dueAt: { lte: now }, state: { not: 'SUSPENDED' } } }),
    prisma.vocabEntry.count({ where: { userId } }),
    prisma.grammarTopic.count({ where: { userId } }),
    prisma.homework.count({ where: { userId } }),
    prisma.learnerProfile.findUnique({ where: { userId }, select: { cefrLevel: true } }),
    prisma.review.count({ where: { srsCard: { userId }, prevInterval: { gte: 1 }, grade: { gte: 3 } } }),
    prisma.review.count({ where: { srsCard: { userId }, prevInterval: { gte: 1 } } }),
  ]);
  const retention = retTotal ? Math.round((retPass / retTotal) * 100) : null;
  // One "to review" number across vocab + grammar; send the click wherever work waits.
  const due = vocabDue + grammarDue;
  const dueHref = vocabDue > 0 ? '/vocabulary/review' : grammarDue > 0 ? '/grammar/review' : '/vocabulary/review';

  type Tone = 'violet' | 'coral' | 'green' | 'amber';
  const stats: Array<{ label: string; value: number; icon: typeof Brain; href: string; tone: Tone; hint?: string }> = [
    {
      label: t('due'),
      value: due,
      icon: Brain,
      href: dueHref,
      tone: 'violet',
      hint: grammarDue > 0 ? t('dueHint', { vocab: vocabDue, grammar: grammarDue }) : undefined,
    },
    { label: t('words'), value: vocab, icon: BookOpen, href: '/vocabulary', tone: 'coral' },
    { label: t('grammarTopics'), value: grammar, icon: SpellCheck2, href: '/grammar', tone: 'green' },
    { label: t('homeworks'), value: homework, icon: NotebookPen, href: '/homework', tone: 'amber' },
  ];
  const TONE = {
    violet: { card: 'bg-primary text-primary-foreground', chip: 'bg-white/20 text-white', lab: 'text-white/80' },
    coral: { card: 'bg-coral/10', chip: 'bg-coral text-coral-foreground', lab: 'text-muted-foreground' },
    green: { card: 'bg-success/10', chip: 'bg-success text-success-foreground', lab: 'text-muted-foreground' },
    amber: { card: 'bg-amber/15', chip: 'bg-amber text-amber-foreground', lab: 'text-muted-foreground' },
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {session?.user.name ? t('greeting', { name: session.user.name }) : t('greetingNoName')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle', { level: profile?.cefrLevel ?? 'A1' })}
            {retention != null ? (
              <>
                {' · '}
                <Link href="/progress" className="font-semibold text-primary hover:underline">
                  {t('retentionInline', { pct: retention })}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Link href="/vocabulary/review" className={buttonVariants()}>
          {t('startReview')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const tn = TONE[s.tone];
          return (
            <Link key={s.label} href={s.href}>
              <Card className={cn('border-transparent transition-transform hover:-translate-y-0.5', tn.card)}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tn.chip)}>
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-3xl font-extrabold tabular-nums">{s.value}</span>
                  <span className={cn('text-sm font-semibold', tn.lab)}>{s.label}</span>
                  {s.hint ? <span className={cn('text-xs', tn.lab)}>{s.hint}</span> : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-medium">{t('helpTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('helpText')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
