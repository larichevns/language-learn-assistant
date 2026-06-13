import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl without locale-prefixed routing: locale comes from a cookie.
// Request config lives in ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray pnpm-lock.yaml in a parent
  // dir (~/Dev) otherwise makes Next infer that as the root and warn on startup.
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // Headroom for vision-homework image uploads (base64 data URLs).
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default withNextIntl(nextConfig);
