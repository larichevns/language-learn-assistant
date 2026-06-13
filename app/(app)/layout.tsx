import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { AssistantDock } from '@/components/assistant/assistant-dock';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

/** Consecutive days (ending today or yesterday) with at least one review. */
function computeStreak(dates: Date[]): number {
  const days = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
    } else if (i > 0) {
      break; // allow "today not yet reviewed" only on the first step
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const isAdmin = session.user.role === 'ADMIN';

  const since = new Date(Date.now() - 60 * 86_400_000);
  const reviews = await prisma.review.findMany({
    where: { srsCard: { userId: session.user.id }, reviewedAt: { gte: since } },
    select: { reviewedAt: true },
  });
  const streak = computeStreak(reviews.map((r) => r.reviewedAt));

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar isAdmin={isAdmin} streak={streak} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.user.name} email={session.user.email} isAdmin={isAdmin} />
        <main className="flex-1">{children}</main>
      </div>
      <AssistantDock />
    </div>
  );
}
