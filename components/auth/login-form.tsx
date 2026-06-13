'use client';

import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const callbackUrl = useSearchParams().get('callbackUrl') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError(t('badCredentials'));
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <span className="text-xs font-medium text-muted-foreground">LanguageLearnAssistant</span>
        <CardTitle className="text-xl">{t('signInTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('password')}</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? <Spinner /> : t('signIn')}
          </Button>
        </form>

        {googleEnabled && (
          <Button variant="outline" onClick={() => signIn('google', { callbackUrl })} type="button">
            {t('googleSignIn')}
          </Button>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('signUpLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
