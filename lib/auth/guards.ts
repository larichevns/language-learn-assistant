/**
 * Server-side guards — never trust middleware alone. Each route handler calls
 * requireUser/requireAdmin and (for mutations) asserts ownership BEFORE the
 * service call.
 */
import type { Role } from '@prisma/client';
import { auth } from './index';
import { ApiError } from '../api/errors';

export interface AuthedUser {
  userId: string;
  role: Role;
  tier: string;
}

export async function requireUser(): Promise<AuthedUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError('unauthorized', 'Authentication required', 401);
  }
  return {
    userId: session.user.id,
    role: session.user.role ?? 'USER',
    tier: session.user.tier ?? 'free',
  };
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    throw new ApiError('forbidden', 'Administrator access required', 403);
  }
  return user;
}

/** Throw unless `resourceUserId` belongs to `userId`. Use AFTER loading the row. */
export function assertOwner(resourceUserId: string | null | undefined, userId: string): void {
  if (!resourceUserId) throw new ApiError('not_found', 'Resource not found', 404);
  if (resourceUserId !== userId) throw new ApiError('forbidden', 'Not your resource', 403);
}

/** Service-to-service token (crons / internal callbacks). Fail-closed. */
export function requireServiceToken(req: Request): void {
  const token = req.headers.get('x-service-token');
  const expected = process.env.AI_SERVICE_TOKEN;
  if (!expected || token !== expected) {
    throw new ApiError('forbidden', 'Invalid service token', 403);
  }
}
