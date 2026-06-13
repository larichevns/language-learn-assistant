/**
 * Assemble the envelope DATA from Postgres ("DB is the memory"). Loads the
 * shared knowledge (profile + vocab + grammar), the current unit, and the
 * scope object. Thread summary + verbatim history are passed in by the caller
 * (which owns get-or-create of the ChatThread).
 */
import type { ScopeType } from '@prisma/client';
import { prisma } from '../../db/client';
import type { Message } from '../types';
import type { EnvelopeData } from './builder';
import { SYSTEM_PERSONA, formatScope, formatShared, formatThreadSummary, formatUnit } from './layers';

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

  const [profile, vocab, grammarTopics, currentUnit, scopeObject] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.vocabEntry.findMany({ where: { userId }, take: 60, orderBy: { updatedAt: 'desc' } }),
    prisma.grammarTopic.findMany({ where: { userId }, take: 40, orderBy: { updatedAt: 'desc' } }),
    prisma.unit.findFirst({ where: { course: { userId }, isCurrent: true } }),
    loadScopeObject(userId, opts.scopeType, opts.scopeId),
  ]);

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
    })),
    grammarTopics: grammarTopics.map((g) => ({
      title: g.title,
      category: g.category,
      masteryScore: g.masteryScore,
    })),
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
    scope,
    threadSummary,
    history: opts.history ?? [],
    userMessage: opts.userMessage,
  };
}
