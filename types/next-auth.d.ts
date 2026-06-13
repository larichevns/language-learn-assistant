import type { Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role?: Role;
    tier?: string;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      tier: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: Role;
    tier?: string;
  }
}
