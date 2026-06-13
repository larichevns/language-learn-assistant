import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { errorResponse, handleApiError, successResponse } from '@/lib/api/response';

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = RegisterBody.safeParse(json);
    if (!parsed.success) {
      return errorResponse('invalid_input', 'Invalid registration data', 400);
    }
    const email = parsed.data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return errorResponse('email_taken', 'Email already registered', 409);

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
        role: 'USER',
        tier: 'free',
        learnerProfile: { create: {} },
        courses: { create: { title: 'Deutsch', isActive: true } },
      },
      select: { id: true, email: true },
    });

    return successResponse(user, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
