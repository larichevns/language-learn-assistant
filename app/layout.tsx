import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from './providers';
import { SwRegister } from '@/components/sw-register';
import './globals.css';

// Phase 7: Nunito (rounded, friendly) for both body and display.
const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  weight: ['500', '600', '700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'LanguageLearnAssistant', template: '%s · LLA' },
  description: 'AI-ассистент для изучения немецкого языка',
  applicationName: 'LanguageLearnAssistant',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#11151f' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={nunito.variable}
    >
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
          <SwRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
