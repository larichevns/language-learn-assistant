import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { computeStreak } from '@/lib/learning/metrics';
import { AssistantDock } from '@/components/assistant/assistant-dock';
import { OfflineSync } from '@/components/offline-sync';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const isAdmin = session.user.role === 'ADMIN';

  // Streak counts ANY learning activity (reviews + attempts) — one shared
  // implementation with /progress (lib/learning/metrics.computeStreak).
  const since = new Date(Date.now() - 60 * 86_400_000);
  const [reviews, attempts] = await Promise.all([
    prisma.review.findMany({
      where: { srsCard: { userId: session.user.id }, reviewedAt: { gte: since } },
      select: { reviewedAt: true },
    }),
    prisma.attempt.findMany({
      where: { userId: session.user.id, attemptedAt: { gte: since } },
      select: { attemptedAt: true },
    }),
  ]);
  const streak = computeStreak([...reviews.map((r) => r.reviewedAt), ...attempts.map((a) => a.attemptedAt)]);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar isAdmin={isAdmin} streak={streak} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.user.name} email={session.user.email} isAdmin={isAdmin} />
        <main className="flex-1">{children}</main>
      </div>
      <AssistantDock />
      <OfflineSync />
    </div>
  );
}
