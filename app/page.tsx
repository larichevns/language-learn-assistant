import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function LandingPage() {
  const t = useTranslations('landing');

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* calm study-themed ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-12rem] right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-accent/40 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-2xl animate-fade-in text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          {t('phase')}
        </span>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          {t('subtitle')}
        </p>

        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('ctaPrimary')}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t('ctaSecondary')}
          </Link>
        </div>
      </div>
    </main>
  );
}
