/**
 * Lightweight prompt-injection / jailbreak guard. Tight rules to avoid
 * false-positives on genuine German-learning questions. Logs an AbuseEvent on
 * any match; blocks on a match (severity "block").
 */
import { prisma } from '../../db/client';

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: 'ignore_instructions', re: /ignore\s+(all\s+|the\s+|your\s+|previous\s+)*(instructions|rules|the\s+prompt|system\s+prompt)/i },
  { name: 'reveal_prompt', re: /(reveal|show|print|repeat|output)\b.{0,24}\b(system\s+)?(prompt|instructions)/i },
  { name: 'jailbreak', re: /\b(DAN mode|do anything now|developer mode|jailbreak)\b/i },
  { name: 'role_override', re: /\b(you are now|forget (that )?you are|act as an? (unrestricted|uncensored|evil))\b/i },
];

export interface AbuseResult {
  matched: string[];
  blocked: boolean;
}

export function detectAbuse(text: string): AbuseResult {
  const matched = RULES.filter((r) => r.re.test(text)).map((r) => r.name);
  return { matched, blocked: matched.length > 0 };
}

export async function guardAbuse(
  userId: string | null | undefined,
  featureSlug: string,
  text: string,
): Promise<AbuseResult> {
  const result = detectAbuse(text);
  if (result.matched.length > 0) {
    await prisma.abuseEvent.create({
      data: {
        userId: userId ?? null,
        featureSlug,
        severity: result.blocked ? 'block' : 'warn',
        rulesJson: result.matched,
        contentPreview: text.slice(0, 50),
      },
    });
  }
  return result;
}
