/**
 * Envelope builder. Produces the logical, layered message list (static → dynamic).
 * The provider coalesces consecutive same-role turns into a valid wire format.
 *
 *   systemInstruction ← 01 persona/rules
 *   messages[0] user  ← 02 shared + 03 unit          (most-static cacheable prefix)
 *   messages[1] user  ← 03.5 focus + 04 scope + 05 summary  (volatile — NOT cached)
 *   messages[..]      ← verbatim history (user/model)
 *   messages[last]    ← 06 new user message
 *
 * The focus-block (due/weak/recent-errors) is highly volatile, so it lives in
 * the dynamic message[1] AFTER the cached prefix — never in message[0], which
 * must stay byte-stable for the prefix cache. See phase-5-implementation-plan §4.3.
 */
import type { Message } from '../types';

export interface EnvelopeData {
  system: string;
  shared?: string;
  unit?: string;
  focus?: string;
  scope?: string;
  threadSummary?: string;
  history: Message[];
  userMessage: string;
}

export interface BuiltEnvelope {
  systemInstruction: string;
  messages: Message[];
}

function present(...parts: Array<string | undefined>): string {
  return parts.filter((x): x is string => Boolean(x && x.trim())).join('\n\n').trim();
}

export function buildEnvelope(data: EnvelopeData): BuiltEnvelope {
  const messages: Message[] = [];

  const block0 = present(data.shared, data.unit);
  if (block0) messages.push({ role: 'user', content: block0 });

  const block1 = present(data.focus, data.scope, data.threadSummary);
  if (block1) messages.push({ role: 'user', content: block1 });

  // History fed before the live user message must end on a model turn. A dangling
  // user turn — a prior message whose assistant reply never persisted (aborted
  // stream, timeout, or an empty/proposal-only response) — would otherwise coalesce
  // with the new user message at the provider, and the model would answer the stale
  // question first. Drop empty turns, then trim any trailing user turn(s).
  const history = data.history.filter((m) => m.content.trim());
  let end = history.length;
  while (end > 0 && history[end - 1]?.role === 'user') end--;
  for (const m of history.slice(0, end)) {
    messages.push({ role: m.role, content: m.content });
  }

  messages.push({ role: 'user', content: data.userMessage });

  return { systemInstruction: data.system, messages };
}
