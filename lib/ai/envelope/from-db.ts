/**
 * Assemble the envelope DATA from Postgres ("DB is the memory"). Loads the
 * shared knowledge (profile + vocab + grammar), the current unit, and the
 * scope object. Thread summary + verbatim history are passed in by the caller
 * (which owns get-or-create of the ChatThread).
 */
import type { GroupDomain, ScopeType } from '@prisma/client';
import { prisma } from '../../db/client';
import type { Message } from '../types';
import type { EnvelopeData } from './builder';
import { decayedMastery, masteryBucket, NEEDS_WORK_THRESHOLD } from '../../learning/decay';
import { SYSTEM_PERSONA, formatFocus, formatScope, formatShared, formatThreadSummary, formatUnit } from './layers';

/** Build a short, grounded label for a recent non-vocab error from the Attempt log. */
function recentErrorLabel(a: { source: string; category: string | null; errorTypeJson: unknown }): string {
  const cat = a.category ? String(a.category) : 'ошибка';
  const meta = a.errorTypeJson && typeof a.errorTypeJson === 'object' ? (a.errorTypeJson as { original?: string }) : null;
  const orig = meta?.original;
  const srcRu =
    a.source === 'HOMEWORK' ? 'ДЗ' : a.source === 'EXERCISE_ITEM' ? 'упражнение' : a.source === 'CHAT_DRILL' ? 'чат' : a.source;
  return orig ? `${cat}: «${orig}» (${srcRu})` : `${cat} (${srcRu})`;
}

async function loadScopeObject(
  userId: string,
  scopeType: ScopeType,
  scopeId: string | null | undefined,
): Promise<unknown> {
  if (!scopeId) return null;
  const own = { id: scopeId, userId };
  switch (scopeType) {
    case 'VOCAB_ENTRY':
      return prisma.vocabEntry.findFirst({ where: own });
    case 'GRAMMAR_TOPIC':
      return prisma.grammarTopic.findFirst({ where: own });
    case 'HOMEWORK':
      return prisma.homework.findFirst({ where: own });
    case 'CLASS_NOTE':
      return prisma.classNote.findFirst({ where: own });
    case 'EXERCISE_SET':
      return prisma.exerciseSet.findFirst({ where: own, include: { items: true } });
    case 'UNIT':
      return prisma.unit.findFirst({ where: { id: scopeId, course: { userId } } });
    default:
      return null;
  }
}

export async function assembleEnvelopeFromDb(opts: {
  userId: string;
  scopeType: ScopeType;
  scopeId?: string | null;
  featureSlug?: string;
  userMessage: string;
  history?: Message[];
  threadSummary?: string | null;
}): Promise<EnvelopeData> {
  const { userId } = opts;
  const now = new Date();

  const [
    profile,
    vocab,
    grammarTopics,
    currentUnit,
    scopeObject,
    dueCards,
    lapsedCards,
    recentErrors,
    collGroups,
  ] = await Promise.all([
      prisma.learnerProfile.findUnique({ where: { userId } }),
      prisma.vocabEntry.findMany({
        where: { userId },
        take: 40,
        orderBy: { updatedAt: 'desc' },
        select: {
          lemma: true,
          pos: true,
          translationRu: true,
          cefrLevel: true,
          group: { select: { name: true, parent: { select: { name: true } } } },
        },
      }),
      prisma.grammarTopic.findMany({
        where: { userId },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: {
          title: true,
          category: true,
          masteryScore: true,
          masteryUpdatedAt: true,
          group: { select: { name: true, parent: { select: { name: true } } } },
        },
      }),
      prisma.unit.findFirst({ where: { course: { userId }, isCurrent: true } }),
      loadScopeObject(userId, opts.scopeType, opts.scopeId),
      // Focus-block sources (computed by need, not by recency):
      prisma.srsCard.findMany({
        where: { userId, dueAt: { lte: now }, state: { not: 'SUSPENDED' } },
        orderBy: { dueAt: 'asc' },
        take: 8,
        include: { vocabEntry: { select: { lemma: true, translationRu: true } } },
      }),
      prisma.srsCard.findMany({
        where: { userId, lapses: { gt: 1 } },
        orderBy: { lapses: 'desc' },
        take: 5,
        include: { vocabEntry: { select: { lemma: true } } },
      }),
      prisma.attempt.findMany({
        where: { userId, isCorrect: false, source: { not: 'SRS_REVIEW' } },
        orderBy: { attemptedAt: 'desc' },
        take: 10,
        select: { source: true, category: true, errorTypeJson: true },
      }),
      // Group taxonomy for layer 02 create-or-reuse — ALL domains in one query;
      // split into per-domain arrays below (each picks its matching _count relation).
      prisma.collectionGroup.findMany({
        where: { userId },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          parentId: true,
          domain: true,
          _count: { select: { vocabEntries: true, grammarTopics: true, classNotes: true } },
        },
      }),
    ]);

  // Split the single all-domain group query into per-domain arrays for the
  // shared envelope blocks (each picks its matching _count relation).
  type GNode = { id: string; name: string; parentId: string | null; count: number };
  const pick = (d: GroupDomain, rel: 'vocabEntries' | 'grammarTopics' | 'classNotes'): GNode[] =>
    collGroups
      .filter((g) => g.domain === d)
      .map((g) => ({ id: g.id, name: g.name, parentId: g.parentId, count: g._count[rel] }));
  const vocabGroups = pick('VOCAB', 'vocabEntries');
  const grammarGroups = pick('GRAMMAR', 'grammarTopics');
  const noteGroups = pick('NOTE', 'classNotes');

  // Decay once, reuse for the cached shared layer (bucketed) and the focus-block (ranked).
  const topicsDecayed = grammarTopics.map((t) => ({
    title: t.title,
    category: t.category,
    groupPath: t.group ? (t.group.parent ? `${t.group.parent.name}→${t.group.name}` : t.group.name) : undefined,
    decayed: decayedMastery(t.masteryScore, t.masteryUpdatedAt, now, t.category),
  }));

  const shared = formatShared({
    profile: {
      cefrLevel: profile?.cefrLevel,
      nativeLang: profile?.nativeLang,
      targetLang: profile?.targetLang,
      goals: (profile?.goalsJson as string[] | null) ?? undefined,
      weakAreas: (profile?.weakAreasJson as string[] | null) ?? undefined,
      formalityPref: profile?.formalityPref,
    },
    vocab: vocab.map((v) => ({
      lemma: v.lemma,
      pos: v.pos,
      translationRu: v.translationRu,
      cefrLevel: v.cefrLevel ?? undefined,
      groupPath: v.group ? (v.group.parent ? `${v.group.parent.name}→${v.group.name}` : v.group.name) : undefined,
    })),
    grammarTopics: topicsDecayed.slice(0, 40).map((t) => ({
      title: t.title,
      category: t.category ?? undefined,
      bucket: masteryBucket(t.decayed),
      groupPath: t.groupPath,
    })),
    vocabGroups,
    grammarGroups,
    noteGroups,
  });

  const focus = formatFocus({
    dueCards: dueCards.map((c) => ({ lemma: c.vocabEntry.lemma, translationRu: c.vocabEntry.translationRu })),
    lapsedCards: lapsedCards.map((c) => ({ lemma: c.vocabEntry.lemma })),
    weakTopics: [...topicsDecayed]
      .filter((t) => t.decayed < NEEDS_WORK_THRESHOLD)
      .sort((a, b) => a.decayed - b.decayed)
      .slice(0, 5)
      .map((t) => ({ title: t.title, decayed: t.decayed })),
    recentErrors: recentErrors.map((a) => ({ label: recentErrorLabel(a) })),
  });

  const unit = formatUnit(
    currentUnit
      ? {
          title: currentUnit.title,
          premise: currentUnit.premise ?? undefined,
          summary: currentUnit.summary ?? undefined,
        }
      : undefined,
  );

  const scope = formatScope(opts.scopeType, scopeObject, opts.featureSlug);
  const threadSummary = formatThreadSummary(opts.threadSummary ?? undefined);

  return {
    system: SYSTEM_PERSONA,
    shared,
    unit,
    focus,
    scope,
    threadSummary,
    history: opts.history ?? [],
    userMessage: opts.userMessage,
  };
}
