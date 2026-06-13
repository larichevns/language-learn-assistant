'use client';

import { GraduationCap, Settings, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV } from './nav-items';

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkCls = (href: string) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive(href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    );

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <span className="font-display text-sm font-bold">LLA</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map(({ href, key, icon: Icon }) => (
          <Link key={href} href={href} className={linkCls(href)}>
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-1">
          {isAdmin && (
            <Link href="/admin" className={linkCls('/admin')}>
              <ShieldCheck className="h-4 w-4" />
              {t('admin')}
            </Link>
          )}
          <Link href="/settings" className={linkCls('/settings')}>
            <Settings className="h-4 w-4" />
            {t('settings')}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
