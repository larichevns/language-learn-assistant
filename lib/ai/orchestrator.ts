/**
 * executeCompletion() — the single path every AI feature runs through:
 *   abuse → rate-limit → daily budget → route → build request from DB → call → log usage.
 * Background ops skip abuse/rate/budget and never bill. A streaming variant
 * powers the SSE chat route.
 */
import type { ScopeType } from '@prisma/client';
import { ApiError } from '../api/errors';
import { buildEnvelope } from './envelope/builder';
import { assembleEnvelopeFromDb } from './envelope/from-db';
import { getFeature } from './features/templates';
import { guardAbuse } from './guards/abuse';
import { guardDailyBudget } from './guards/cost';
import { guardRate } from './guards/rate';
import { routeByFeature, type RoutedModel } from './providers/registry';
import {
  type CompletionChunk,
  type CompletionRequest,
  type CompletionResponse,
  emptyUsage,
  type ImagePart,
  type Message,
  type ToolChoice,
  type ToolDecl,
  type Usage,
} from './types';
import { logUsage } from './usage/tracker';

export interface ExecuteOptions {
  featureSlug: string;
  userId?: string;
  tier?: string;
  scopeType?: ScopeType;
  scopeId?: string | null;
  userMessage: string;
  history?: Message[];
  threadSummary?: string | null;
  tools?: ToolDecl[];
  toolChoice?: ToolChoice;
  /** images attached to the final user message (e.g. homework photo for vision) */
  images?: ImagePart[];
  isBackground?: boolean;
  skipRateLimit?: boolean;
  requestId?: string;
  signal?: AbortSignal;
  /** for non-envelope features (e.g. summarize): supply the messages directly */
  systemOverride?: string;
  messagesOverride?: Message[];
}

interface Prepared {
  req: CompletionRequest;
  routed: RoutedModel;
  operationType: string;
  isBackground: boolean;
}

async function prepare(opts: ExecuteOptions): Promise<Prepared> {
  const feature = getFeature(opts.featureSlug);
  const isBackground = Boolean(opts.isBackground || feature.isBackground);
  const operationType = isBackground ? 'background' : 'text_completion';

  if (!isBackground && opts.userId && opts.userMessage) {
    const abuse = await guardAbuse(opts.userId, opts.featureSlug, opts.userMessage);
    if (abuse.blocked) throw new ApiError('abuse_blocked', 'Message blocked by the safety guard', 400);
  }

  if (opts.userId && !opts.skipRateLimit && !isBackground) {
    const rate = await guardRate(opts.userId, 'all', opts.tier ?? 'free');
    if (!rate.allowed) {
      const retryS = rate.retryAfterMs ? String(Math.ceil(rate.retryAfterMs / 1000)) : undefined;
      throw new ApiError(
        'rate_limited',
        `Rate limit reached (${rate.scope}). Try again shortly.`,
        429,
        retryS ? { 'Retry-After': retryS } : undefined,
      );
    }
  }

  if (opts.userId && !isBackground) {
    const budget = await guardDailyBudget(opts.userId, opts.tier ?? 'free');
    if (!budget.allowed) {
      throw new ApiError('budget_exceeded', `Daily budget exceeded ($${budget.spent.toFixed(2)} / $${budget.limit}).`, 402);
    }
  }

  const routed = await routeByFeature(opts.featureSlug);

  let req: CompletionRequest;
  if (opts.messagesOverride) {
    req = {
      modelId: routed.modelId,
      systemInstruction: opts.systemOverride,
      messages: opts.messagesOverride,
      reasoningEffort: feature.reasoningEffort,
      signal: opts.signal,
    };
  } else {
    if (!opts.userId) throw new ApiError('unauthorized', 'Authentication required', 401);
    const data = await assembleEnvelopeFromDb({
      userId: opts.userId,
      scopeType: opts.scopeType ?? 'GLOBAL',
      scopeId: opts.scopeId,
      featureSlug: opts.featureSlug,
      userMessage: opts.userMessage,
      history: opts.history,
      threadSummary: opts.threadSummary,
    });
    const env = buildEnvelope(data);
    if (opts.images?.length) {
      const last = env.messages[env.messages.length - 1];
      if (last) last.images = opts.images;
    }
    req = {
      modelId: routed.modelId,
      systemInstruction: env.systemInstruction,
      messages: env.messages,
      tools: opts.tools,
      toolChoice: opts.toolChoice,
      reasoningEffort: feature.reasoningEffort,
      signal: opts.signal,
    };
  }

  return { req, routed, operationType, isBackground };
}

export async function executeCompletion(opts: ExecuteOptions): Promise<CompletionResponse> {
  const { req, routed, operationType, isBackground } = await prepare(opts);
  const t0 = Date.now();
  try {
    const response = await routed.provider.complete(req);
    await logUsage({
      userId: opts.userId,
      requestId: opts.requestId,
      featureSlug: opts.featureSlug,
      operationType,
      providerSlug: routed.providerSlug,
      modelId: routed.modelId,
      usage: response.usage,
      pricing: routed.pricing,
      status: 'ok',
      latencyMs: Date.now() - t0,
      isBackground,
    });
    return response;
  } catch (e) {
    await logUsage({
      userId: opts.userId,
      requestId: opts.requestId,
      featureSlug: opts.featureSlug,
      operationType,
      providerSlug: routed.providerSlug,
      modelId: routed.modelId,
      usage: emptyUsage(),
      status: 'error',
      errorMessage: (e as Error).message,
      latencyMs: Date.now() - t0,
      isBackground,
    });
    throw e;
  }
}

export async function* streamCompletion(opts: ExecuteOptions): AsyncGenerator<CompletionChunk, void, unknown> {
  const { req, routed, operationType, isBackground } = await prepare(opts);
  const t0 = Date.now();
  let usage: Usage | undefined;
  try {
    for await (const chunk of routed.provider.stream(req)) {
      if (chunk.usage) usage = chunk.usage;
      yield chunk;
    }
    await logUsage({
      userId: opts.userId,
      requestId: opts.requestId,
      featureSlug: opts.featureSlug,
      operationType,
      providerSlug: routed.providerSlug,
      modelId: routed.modelId,
      usage: usage ?? emptyUsage(),
      pricing: routed.pricing,
      status: 'ok',
      latencyMs: Date.now() - t0,
      isBackground,
    });
  } catch (e) {
    await logUsage({
      userId: opts.userId,
      requestId: opts.requestId,
      featureSlug: opts.featureSlug,
      operationType,
      providerSlug: routed.providerSlug,
      modelId: routed.modelId,
      usage: usage ?? emptyUsage(),
      status: 'error',
      errorMessage: (e as Error).message,
      latencyMs: Date.now() - t0,
      isBackground,
    });
    throw e;
  }
}
