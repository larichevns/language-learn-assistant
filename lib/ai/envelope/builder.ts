/**
 * Envelope builder. Produces the logical, layered message list (static → dynamic).
 * The provider coalesces consecutive same-role turns into a valid wire format.
 *
 *   systemInstruction ← 01 persona/rules
 *   messages[0] user  ← 02 shared + 03 unit      (most-static cacheable prefix)
 *   messages[1] user  ← 04 scope + 05 summary    (more dynamic)
 *   messages[..]      ← verbatim history (user/model)
 *   messages[last]    ← 06 new user message
 */
import type { Message } from '../types';

export interface EnvelopeData {
  system: string;
  shared?: string;
  unit?: string;
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

  const block1 = present(data.scope, data.threadSummary);
  if (block1) messages.push({ role: 'user', content: block1 });

  for (const m of data.history) {
    if (m.content.trim()) messages.push({ role: m.role, content: m.content });
  }

  messages.push({ role: 'user', content: data.userMessage });

  return { systemInstruction: data.system, messages };
}
