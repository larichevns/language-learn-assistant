'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const LOCALES = [
  { code: 'ru', labelKey: 'languageRu' as const },
  { code: 'en', labelKey: 'languageEn' as const },
];

function setLocaleCookie(loc: string) {
  document.cookie = `lla_locale=${loc}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [current, setCurrent] = useState('ru');
  const [retention, setRetention] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)lla_locale=(\w+)/);
    setCurrent(m?.[1] ?? 'ru');
    apiGet<{ desiredRetention: number }>('/api/profile')
      .then((p) => setRetention(p.desiredRetention))
      .catch(() => {});
  }, []);

  // Live value while dragging; debounced PATCH so we don't spam the API.
  function onRetentionChange(v: number) {
    setRetention(v);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiPatch('/api/profile', { desiredRetention: v }).catch(() => {});
    }, 400);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 font-display text-2xl font-bold">{t('title')}</h1>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">{t('language')}</h2>
          <div className="flex gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => current !== l.code && setLocaleCookie(l.code)}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm transition-colors',
                  current === l.code ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent',
                )}
              >
                {t(l.labelKey)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-1 p-5">
          <h2 className="text-sm font-semibold">{t('theme')}</h2>
          <p className="text-sm text-muted-foreground">{t('themeHint')}</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold">{t('retentionTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('retentionHint')}</p>
          </div>
          {retention != null ? (
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0.8}
                max={0.97}
                step={0.01}
                value={retention}
                onChange={(e) => onRetentionChange(parseFloat(e.target.value))}
                className="flex-1 accent-primary"
                aria-label={t('retentionTitle')}
              />
              <span className="w-12 text-right font-display text-lg font-bold tabular-nums">
                {Math.round(retention * 100)}%
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('retentionLoading')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold">{t('export')}</h2>
            <p className="text-sm text-muted-foreground">{t('exportHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { fmt: 'json', label: t('exportAll') },
              { fmt: 'vocab-csv', label: t('exportVocab') },
              { fmt: 'revlog-csv', label: t('exportRevlog') },
            ].map((x) => (
              <a
                key={x.fmt}
                href={`/api/export?format=${x.fmt}`}
                download
                className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
              >
                <Download className="h-4 w-4" />
                {x.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
