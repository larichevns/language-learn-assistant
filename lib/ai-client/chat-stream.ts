'use client';

export interface ChatProposal {
  id: string;
  targetType: string;
  op: string;
  targetId?: string | null;
  summary: string;
  payload: unknown;
  status: string;
}

export interface ChatStreamHandlers {
  onToken?: (text: string) => void;
  onProposal?: (p: ChatProposal) => void;
  onUsage?: (u: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
  onFinish?: (reason: string) => void;
  onError?: (e: { code?: string; message: string; retryAfter?: string }) => void;
  onDone?: (d: { threadId: string }) => void;
}

export interface ChatStreamBody {
  message: string;
  scopeType?: string;
  scopeId?: string | null;
  feature?: string;
}

/** Consume the app SSE protocol from POST /api/ai/chat. */
export async function streamChat(
  body: ChatStreamBody,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    handlers.onError?.({ message: (e as Error).message });
    return;
  }
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    handlers.onError?.({ code: j.code, message: j.message ?? `HTTP ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';

  const dispatch = (ev: string, data: Record<string, unknown>) => {
    switch (ev) {
      case 'token':
        handlers.onToken?.(String(data.text ?? ''));
        break;
      case 'proposal':
        handlers.onProposal?.(data as unknown as ChatProposal);
        break;
      case 'usage':
        handlers.onUsage?.(data as unknown as { inputTokens: number; outputTokens: number; totalTokens: number });
        break;
      case 'finish':
        handlers.onFinish?.(String(data.reason ?? ''));
        break;
      case 'error':
        handlers.onError?.(data as unknown as { message: string });
        break;
      case 'done':
        handlers.onDone?.(data as unknown as { threadId: string });
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trimEnd();
      buffer = buffer.slice(nl + 1);
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        try {
          dispatch(event, raw ? JSON.parse(raw) : {});
        } catch {
          /* ignore malformed line */
        }
        event = '';
      }
    }
  }
}
