/**
 * Provider base: typed errors + shared HTTP helpers. Concrete providers
 * (Gemini, later OpenAI/Anthropic) extend this and implement the `Provider` API.
 */
import type {
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
  Provider,
} from '../types';

export type AIErrorKind =
  | 'RATE_LIMIT'
  | 'UPSTREAM'
  | 'BAD_REQUEST'
  | 'AUTH'
  | 'SAFETY'
  | 'ABORTED'
  | 'UNKNOWN';

export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    kind: AIErrorKind,
    message: string,
    opts: { status?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = 'AIError';
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export function classifyHttp(status: number): AIErrorKind {
  if (status === 429) return 'RATE_LIMIT';
  if (status === 401 || status === 403) return 'AUTH';
  if (status >= 500) return 'UPSTREAM';
  if (status >= 400) return 'BAD_REQUEST';
  return 'UNKNOWN';
}

/** Parse Gemini-style RetryInfo "37s" / "1.5s" → milliseconds. */
export function parseRetryDelay(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const m = /^([\d.]+)s$/.exec(raw.trim());
  if (!m || m[1] === undefined) return undefined;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
}

export abstract class BaseProvider implements Provider {
  abstract readonly slug: string;
  abstract complete(req: CompletionRequest): Promise<CompletionResponse>;
  abstract stream(
    req: CompletionRequest,
  ): AsyncGenerator<CompletionChunk, void, unknown>;
  abstract countTokens(req: CompletionRequest): Promise<number>;
  abstract healthCheck(): Promise<{ ok: boolean; detail?: string }>;

  protected async postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw new AIError('ABORTED', 'Request aborted', { cause: err });
      throw new AIError('UPSTREAM', `Network error: ${(err as Error).message}`, { cause: err });
    }
    if (!res.ok) throw await this.errorFromResponse(res);
    return res;
  }

  protected async errorFromResponse(res: Response): Promise<AIError> {
    const kind = classifyHttp(res.status);
    let detail = `HTTP ${res.status}`;
    let retryAfterMs = parseRetryDelay(res.headers.get('retry-after') ?? undefined);
    try {
      const data = (await res.json()) as {
        error?: { message?: string; details?: Array<Record<string, unknown>> };
      };
      if (data.error?.message) detail = data.error.message;
      for (const d of data.error?.details ?? []) {
        const delay = (d as { retryDelay?: string }).retryDelay;
        const parsed = parseRetryDelay(delay);
        if (parsed != null) retryAfterMs = parsed;
      }
    } catch {
      // non-JSON body — keep the status detail
    }
    return new AIError(kind, detail, { status: res.status, retryAfterMs });
  }
}
