'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDock } from '@/lib/stores/dock';
import { AccountMenu } from './account-menu';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';

export function Topbar({ name, email, isAdmin }: { name?: string | null; email?: string | null; isAdmin: boolean }) {
  const t = useTranslations('nav');
  const toggle = useDock((s) => s.toggle);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav isAdmin={isAdmin} />
        <span className="font-display text-sm font-semibold text-muted-foreground md:hidden">LLA</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={toggle} className="gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">{t('assistant')}</span>
        </Button>
        <ThemeToggle />
        <AccountMenu name={name} email={email} />
      </div>
    </header>
  );
}
