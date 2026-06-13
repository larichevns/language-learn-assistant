import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

// i18n without locale-prefixed routing: the active locale is stored in a cookie.
// UI default is Russian; English exists as a fallback from day one.
export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';
export const LOCALE_COOKIE = 'lla_locale';

function isLocale(value: string | undefined): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
