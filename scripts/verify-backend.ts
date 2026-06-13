/**
 * Phase-2 backend verification (no HTTP/auth needed): exercises the DB-backed
 * orchestrator, propose→persist→apply, and usage logging against the live DB
 * (and Gemini if GEMINI_API_KEY is set). Run: npx tsx scripts/verify-backend.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { executeCompletion } from '../lib/ai/orchestrator';
import { applyProposalDb } from '../lib/ai/propose/apply-db';
import { persistProposal } from '../lib/ai/propose/persist';
import { proposeToolDecl } from '../lib/ai/propose/tool';
import type { ToolCall } from '../lib/ai/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
(function loadEnv() {
  const p = resolve(ROOT, '.env');
  if (!existsSync(p)) return;
  const seen = new Set<string>();
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || !m[1]) continue;
    const key = m[1];
    const val = (m[2] ?? '').replace(/^["']|["']$/g, '');
    if (key in process.env && !seen.has(key)) continue;
    process.env[key] = val;
    seen.add(key);
  }
})();

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@lla.local' } });
  if (!admin) {
    console.error('No admin user. Run `npx prisma db seed` first.');
    process.exit(1);
  }

  // A — propose → persist → apply, no network
  const call: ToolCall = {
    name: 'propose',
    args: {
      target_type: 'VOCAB_ENTRY',
      op: 'CREATE',
      summary: 'Добавить die Katze',
      payload: JSON.stringify({
        lemma: 'die Katze',
        pos: 'NOUN',
        translationRu: 'кошка',
        gender: 'DIE',
        pluralForm: 'Katzen',
        cefrLevel: 'A1',
      }),
    },
  };
  const proposal = await persistProposal({ userId: admin.id, call });
  const applied = await applyProposalDb(proposal.id, admin.id);
  const katze = await prisma.vocabEntry.findFirst({ where: { userId: admin.id, lemma: 'die Katze' } });
  console.log(`A) apply (no network): ${katze ? `OK → VocabEntry ${applied.entityId} gender=${katze.gender}` : 'FAIL'}`);

  // A2 — re-apply must conflict (409)
  let conflicted = false;
  try {
    await applyProposalDb(proposal.id, admin.id);
  } catch {
    conflicted = true;
  }
  console.log(`A2) double-apply rejected: ${conflicted ? 'OK (409)' : 'FAIL'}`);

  // B — full DB-backed path against Gemini
  if (process.env.GEMINI_API_KEY) {
    const res = await executeCompletion({
      featureSlug: 'tutor_chat',
      userId: admin.id,
      tier: 'admin',
      scopeType: 'GLOBAL',
      userMessage: 'Добавь слово der Löffel (ложка).',
      tools: [proposeToolDecl],
      toolChoice: 'auto',
    });
    console.log(`B) tutor_chat: "${res.text.slice(0, 100).replace(/\n/g, ' ')}…"`);
    const proposeCalls = res.toolCalls.filter((c) => c.name === 'propose');
    console.log(`B) propose calls: ${proposeCalls.length}`);
    for (const c of proposeCalls) {
      const p = await persistProposal({ userId: admin.id, call: c });
      try {
        const a = await applyProposalDb(p.id, admin.id);
        console.log(`   applied ${a.targetType} → ${a.entityId}`);
      } catch (e) {
        console.log(`   apply failed: ${(e as Error).message}`);
      }
    }
    const loeffel = await prisma.vocabEntry.findFirst({ where: { userId: admin.id, lemma: { contains: 'Löffel' } } });
    console.log(`B) Löffel saved: ${loeffel ? `OK lemma="${loeffel.lemma}" gender=${loeffel.gender ?? '-'}` : 'not saved'}`);
  } else {
    console.log('B) skipped (no GEMINI_API_KEY)');
  }

  // C — usage events logged
  const usage = await prisma.usageEvent.count({ where: { userId: admin.id } });
  console.log(`C) usage events logged for admin: ${usage}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
