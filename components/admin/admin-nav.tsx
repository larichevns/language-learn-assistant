'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin', label: 'Обзор', exact: true },
  { href: '/admin/usage', label: 'Usage' },
  { href: '/admin/providers', label: 'Провайдеры' },
  { href: '/admin/users', label: 'Юзеры' },
  { href: '/admin/rate-limits', label: 'Лимиты' },
  { href: '/admin/prompts', label: 'Промпты' },
  { href: '/admin/playground', label: 'Playground' },
  { href: '/admin/moderation', label: 'Модерация' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
