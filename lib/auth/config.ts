/**
 * Edge-safe Auth.js config (no Prisma, no bcrypt) — imported by middleware.ts.
 * The full Node config (lib/auth/index.ts) extends this with the Prisma adapter
 * and the Credentials provider.
 */
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import type { Role } from '@prisma/client';

const providers: NextAuthConfig['providers'] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);

export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? 'USER';
        token.tier = (user as { tier?: string }).tier ?? 'free';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const t = token as { id?: string; role?: Role; tier?: string };
        session.user.id = t.id ?? session.user.id;
        session.user.role = t.role ?? 'USER';
        session.user.tier = t.tier ?? 'free';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
