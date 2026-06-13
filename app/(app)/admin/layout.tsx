import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 font-display text-2xl font-bold">Админка</h1>
      <AdminNav />
      <div className="mt-5">{children}</div>
    </div>
  );
}
