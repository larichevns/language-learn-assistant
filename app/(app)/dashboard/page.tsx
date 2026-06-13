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

  const [due, vocab, grammar, homework, profile] = await Promise.all([
    prisma.srsCard.count({ where: { userId, dueAt: { lte: new Date() }, state: { not: 'SUSPENDED' } } }),
    prisma.vocabEntry.count({ where: { userId } }),
    prisma.grammarTopic.count({ where: { userId } }),
    prisma.homework.count({ where: { userId } }),
    prisma.learnerProfile.findUnique({ where: { userId }, select: { cefrLevel: true } }),
  ]);

  const stats = [
    { label: t('due'), value: due, icon: Brain, href: '/vocabulary/review', tone: 'violet' as const },
    { label: t('words'), value: vocab, icon: BookOpen, href: '/vocabulary', tone: 'coral' as const },
    { label: t('grammarTopics'), value: grammar, icon: SpellCheck2, href: '/grammar', tone: 'green' as const },
    { label: t('homeworks'), value: homework, icon: NotebookPen, href: '/homework', tone: 'amber' as const },
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
          <p className="text-sm text-muted-foreground">{t('subtitle', { level: profile?.cefrLevel ?? 'A1' })}</p>
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
