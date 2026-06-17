'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function AccountMenu({ name, email }: { name?: string | null; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label="Аккаунт" onClick={() => setOpen((o) => !o)}>
        <UserIcon className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 max-w-[calc(100vw_-_1rem)] animate-fade-in rounded-xl border border-border bg-popover p-2 shadow-lg">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{name ?? 'Аккаунт'}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
