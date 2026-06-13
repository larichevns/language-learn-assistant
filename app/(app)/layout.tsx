import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AssistantDock } from '@/components/assistant/assistant-dock';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const isAdmin = session.user.role === 'ADMIN';

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.user.name} email={session.user.email} isAdmin={isAdmin} />
        <main className="flex-1">{children}</main>
      </div>
      <AssistantDock />
    </div>
  );
}
