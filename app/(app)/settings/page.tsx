'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)lla_locale=(\w+)/);
    setCurrent(m?.[1] ?? 'ru');
  }, []);

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

      <Card>
        <CardContent className="flex flex-col gap-1 p-5">
          <h2 className="text-sm font-semibold">{t('theme')}</h2>
          <p className="text-sm text-muted-foreground">{t('themeHint')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
