'use client';

import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { flushOutbox, onOutboxChange, pendingCount } from '@/lib/offline/outbox';
import { cn } from '@/lib/utils';

/**
 * Drives the offline write queue and shows a tiny status pill: offline, "N to
 * sync", or a brief "synced". Flushes on reconnect, on tab focus, and on a slow
 * interval (covers "server is back but the network never dropped").
 */
export function OfflineSync() {
  const t = useTranslations('offline');
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const refresh = () => pendingCount().then(setPending);
    refresh();

    const doFlush = async () => {
      const n = await flushOutbox();
      if (n > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
      refresh();
    };

    const onOnline = () => {
      setOnline(true);
      void doFlush();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void doFlush();
    };

    const offChange = onOutboxChange(refresh);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    void doFlush(); // on mount (e.g. app reopened after being offline)
    const iv = setInterval(() => {
      void pendingCount().then((n) => {
        if (n > 0) void doFlush();
      });
    }, 20_000);

    return () => {
      offChange();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(iv);
    };
  }, []);

  if (online && pending === 0 && !justSynced) return null;

  const { icon, text, tone } = !online
    ? { icon: <CloudOff className="h-3.5 w-3.5" />, text: t('offline'), tone: 'bg-muted text-muted-foreground' }
    : pending > 0
      ? { icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />, text: t('pending', { n: pending }), tone: 'bg-amber/20 text-amber-foreground' }
      : { icon: <Check className="h-3.5 w-3.5" />, text: t('synced'), tone: 'bg-success/20 text-success' };

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm',
        tone,
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      {text}
    </div>
  );
}
