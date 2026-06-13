import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl without locale-prefixed routing: locale comes from a cookie.
// Request config lives in ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // PWA (Serwist) is wired in Phase 3.
  // Vision homework upload may need larger server action body limits later.
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default withNextIntl(nextConfig);
