import type { ScopeType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { executeCompletion } from '@/lib/ai/orchestrator';
import { proposeToolDecl } from '@/lib/ai/propose/tool';

const SCOPE_TYPES = [
  'GLOBAL', 'COURSE', 'UNIT', 'VOCAB_ENTRY', 'VOCAB_LIST', 'GRAMMAR_TOPIC', 'HOMEWORK', 'CLASS_NOTE', 'EXERCISE_SET',
] as const;

const Body = z.object({
  featureSlug: z.string(),
  message: z.string().min(1),
  scopeType: z.enum(SCOPE_TYPES).default('GLOBAL'),
  scopeId: z.string().nullish(),
  withTools: z.boolean().default(false),
});

/** Run a feature against its routed model, bypassing rate limits (logged as the admin). */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid request', 400));
    const d = parsed.data;

    const response = await executeCompletion({
      featureSlug: d.featureSlug,
      userId: admin.userId,
      tier: 'admin',
      scopeType: d.scopeType as ScopeType,
      scopeId: d.scopeId ?? null,
      userMessage: d.message,
      skipRateLimit: true,
      tools: d.withTools ? [proposeToolDecl] : undefined,
      toolChoice: d.withTools ? 'auto' : undefined,
    });

    return successResponse({
      text: response.text,
      toolCalls: response.toolCalls,
      usage: response.usage,
      finishReason: response.finishReason,
      modelId: response.modelId,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
