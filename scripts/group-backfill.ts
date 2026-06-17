/**
 * One-off MANUAL backfill of the existing vocabulary into a 2-level
 * group→subgroup taxonomy (the interim, by-hand version of the deferred AI
 * backfill — see vault/specs/vocab-grouping.md).
 *
 * Idempotent: groups are create-or-reused by (userId, parentId, nameNorm),
 * and a word's groupId is (re)assigned only from the TAXONOMY map below.
 * Words not in the map are left untouched (ungrouped).
 *
 *   npx tsx scripts/group-backfill.ts            # DRY-RUN: print the plan
 *   npx tsx scripts/group-backfill.ts --apply    # write groups + groupId
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Dependency-free .env load (no dotenv dep); must run before `new PrismaClient()`.
try {
  for (const line of readFileSync(resolve(process.cwd(), '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const k = m[1];
    if (!k || process.env[k] !== undefined) continue;
    let v = m[2] ?? '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
} catch {
  /* .env optional if vars already in shell */
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const norm = (s: string) => s.trim().toLowerCase(); // matches normGroupName in lib/api/collection-groups
// match key from a lemma: drop a leading article, lowercase (data has both "der Apfel" and "Brücke")
const keyOf = (lemma: string) => lemma.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();

// name:null → words attach DIRECTLY to the top group (leaf = top group id).
const TAXONOMY: { group: string; subgroups: { name: string | null; keys: string[] }[] }[] = [
  {
    group: 'Еда',
    subgroups: [
      { name: 'Фрукты', keys: ['apfel', 'ananas', 'banane', 'birne', 'erdbeere', 'heidelbeere', 'himbeere', 'kirsche', 'mango', 'melone', 'orange', 'pflaume', 'traube', 'zitrone'] },
      { name: 'Овощи и травы', keys: ['karotte', 'kartoffel', 'tomate', 'zwiebel', 'salat', 'basilikum', 'petersilie'] },
      { name: 'Молочное, яйца и рыба', keys: ['milch', 'butter', 'käse', 'joghurt', 'ei', 'fisch'] },
      { name: 'Мясо и колбаса', keys: ['fleisch', 'rindfleisch', 'hähnchen', 'wurst'] },
      { name: 'Зерновые', keys: ['reis', 'nudeln'] },
      { name: 'Выпечка и сладости', keys: ['brot', 'brötchen', 'kuchen', 'bonbon', 'schokolade'] },
    ],
  },
  { group: 'Путешествия и город', subgroups: [{ name: null, keys: ['bahnhof', 'brücke', 'führung', 'schule'] }] },
  { group: 'Дом', subgroups: [{ name: null, keys: ['haus', 'tisch', 'löffel'] }] },
];

// key → human-readable destination path, for the plan/typo-check
const keyToPath = new Map<string, string>();
for (const t of TAXONOMY)
  for (const s of t.subgroups)
    for (const k of s.keys) keyToPath.set(k, s.name ? `${t.group} → ${s.name}` : t.group);

async function findOrCreateGroup(userId: string, parentId: string | null, name: string): Promise<string> {
  const nameNorm = norm(name);
  const existing = await prisma.collectionGroup.findFirst({
    where: { userId, domain: 'VOCAB', parentId, nameNorm },
    select: { id: true },
  });
  if (existing) return existing.id;
  if (!APPLY) return `(new:${name})`;
  const created = await prisma.collectionGroup.create({ data: { userId, domain: 'VOCAB', parentId, name, nameNorm } });
  return created.id;
}

async function main() {
  const words = await prisma.vocabEntry.findMany({
    select: { id: true, userId: true, lemma: true, translationRu: true, groupId: true },
    orderBy: [{ userId: 'asc' }, { lemma: 'asc' }],
  });
  const userIds = [...new Set(words.map((w) => w.userId))];

  console.log(`\n${APPLY ? '=== APPLYING ===' : '=== DRY-RUN (no writes; pass --apply) ==='}`);
  console.log(`${words.length} words across ${userIds.length} user(s).\n`);

  // typo check: any taxonomy key that matches no actual word?
  const presentKeys = new Set(words.map((w) => keyOf(w.lemma)));
  const orphanKeys = [...keyToPath.keys()].filter((k) => !presentKeys.has(k));
  if (orphanKeys.length) console.log(`⚠ taxonomy keys with NO matching word (check spelling): ${orphanKeys.join(', ')}\n`);

  for (const userId of userIds) {
    const mine = words.filter((w) => w.userId === userId);
    // resolve every leaf id once
    const leafId = new Map<string, string>(); // path-name → leaf group id
    for (const t of TAXONOMY) {
      const topId = await findOrCreateGroup(userId, null, t.group);
      for (const s of t.subgroups) {
        const id = s.name ? await findOrCreateGroup(userId, topId, s.name) : topId;
        leafId.set(s.name ? `${t.group}/${s.name}` : t.group, id);
      }
    }

    let assigned = 0;
    const ungrouped: string[] = [];
    for (const w of mine) {
      const k = keyOf(w.lemma);
      const dest = TAXONOMY.flatMap((t) => t.subgroups.map((s) => ({ t, s }))).find((x) => x.s.keys.includes(k));
      if (!dest) {
        ungrouped.push(`${w.lemma} (${w.translationRu})`);
        continue;
      }
      const targetId = leafId.get(dest.s.name ? `${dest.t.group}/${dest.s.name}` : dest.t.group)!;
      assigned++;
      if (APPLY && w.groupId !== targetId && !targetId.startsWith('(new'))
        await prisma.vocabEntry.update({ where: { id: w.id }, data: { groupId: targetId } });
    }

    // plan print
    console.log(`── user ${userId} ──`);
    for (const t of TAXONOMY) {
      console.log(`  ${t.group}`);
      for (const s of t.subgroups) {
        const inThis = mine.filter((w) => s.keys.includes(keyOf(w.lemma)));
        const label = s.name ? `    └ ${s.name}` : `    └ (прямо в группе)`;
        console.log(`${label}: ${inThis.map((w) => w.lemma.replace(/^(der|die|das)\s+/i, '')).join(', ') || '—'}`);
      }
    }
    console.log(`  Без группы (${ungrouped.length}): ${ungrouped.join(', ') || '—'}`);
    console.log(`  → ${assigned} words ${APPLY ? 'assigned' : 'would be assigned'}, ${ungrouped.length} left ungrouped.\n`);
  }

  // ── readback: actual persisted state from the DB ──
  console.log('=== Persisted group tree (from DB) ===');
  for (const userId of userIds) {
    const tops = await prisma.collectionGroup.findMany({
      where: { userId, domain: 'VOCAB', parentId: null },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        _count: { select: { vocabEntries: true } },
        children: { orderBy: { name: 'asc' }, select: { name: true, _count: { select: { vocabEntries: true } } } },
      },
    });
    for (const t of tops) {
      console.log(`  ${t.name} — ${t._count.vocabEntries} прямых`);
      for (const c of t.children) console.log(`    └ ${c.name} (${c._count.vocabEntries})`);
    }
    const ung = await prisma.vocabEntry.count({ where: { userId, groupId: null } });
    console.log(`  Без группы: ${ung}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
