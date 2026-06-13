'use client';

import { Menu, Settings, ShieldCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NAV } from './nav-items';

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkCls = (href: string) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
      isActive(href) ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
    );

  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon" aria-label="Меню" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 flex h-full w-64 animate-fade-in flex-col gap-1 border-r border-border bg-card p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-display font-bold">LLA</span>
              <Button variant="ghost" size="icon" aria-label="Закрыть" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {NAV.map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} className={linkCls(href)}>
                <Icon className="h-4 w-4" />
                {t(key)}
              </Link>
            ))}
            <div className="mt-auto flex flex-col gap-1">
              {isAdmin && (
                <Link href="/admin" className={linkCls('/admin')}>
                  <ShieldCheck className="h-4 w-4" /> {t('admin')}
                </Link>
              )}
              <Link href="/settings" className={linkCls('/settings')}>
                <Settings className="h-4 w-4" /> {t('settings')}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
