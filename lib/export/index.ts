/**
 * Data export (Slice 7) — the learner owns their data and can take it out in
 * open, human-readable formats: a full versioned JSON dump, an Anki-importable
 * vocab CSV, and the `Review` revlog CSV (rare + valuable — most apps lose it).
 * `.apkg` packaging is a deferred sub-slice. See phase-5-implementation-plan §7.
 */
import { prisma } from '../db/client';

export const EXPORT_SCHEMA_VERSION = 1;

/** Full, re-importable dump of everything the learner owns. */
export async function buildFullExport(userId: string, now: Date = new Date()) {
  const [profile, vocab, grammarTopics, reviews, homeworks, classNotes, exerciseSets, attempts, timeline] =
    await Promise.all([
      prisma.learnerProfile.findUnique({ where: { userId } }),
      prisma.vocabEntry.findMany({ where: { userId }, include: { srsCards: true }, orderBy: { lemma: 'asc' } }),
      prisma.grammarTopic.findMany({ where: { userId }, include: { card: true } }),
      prisma.review.findMany({ where: { srsCard: { userId } }, orderBy: { reviewedAt: 'asc' } }),
      prisma.homework.findMany({ where: { userId }, include: { errors: true } }),
      prisma.classNote.findMany({ where: { userId } }),
      prisma.exerciseSet.findMany({ where: { userId }, include: { items: true } }),
      prisma.attempt.findMany({ where: { userId }, orderBy: { attemptedAt: 'asc' } }),
      prisma.timelineEvent.findMany({ where: { userId }, orderBy: { occurredAt: 'asc' } }),
    ]);
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    profile,
    vocab,
    grammarTopics,
    reviews,
    homeworks,
    classNotes,
    exerciseSets,
    attempts,
    timeline,
  };
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
}

/** Anki-importable vocab CSV (German morphology → note fields). */
export async function buildVocabCsv(userId: string): Promise<string> {
  const vocab = await prisma.vocabEntry.findMany({ where: { userId }, orderBy: { lemma: 'asc' } });
  const headers = [
    'lemma', 'translationRu', 'pos', 'gender', 'pluralForm', 'genitiveForm',
    'partizipII', 'auxiliary', 'cefrLevel', 'examples',
  ];
  const rows = vocab.map((v) => {
    const examples = Array.isArray(v.examplesJson)
      ? (v.examplesJson as Array<{ de?: string; ru?: string }>).map((e) => `${e.de ?? ''} — ${e.ru ?? ''}`).join(' | ')
      : '';
    return [v.lemma, v.translationRu, v.pos, v.gender, v.pluralForm, v.genitiveForm, v.partizipII, v.auxiliary, v.cefrLevel, examples];
  });
  return toCsv(headers, rows);
}

/** The spaced-repetition revlog as CSV (one row per Review). */
export async function buildRevlogCsv(userId: string): Promise<string> {
  const reviews = await prisma.review.findMany({
    where: { srsCard: { userId } },
    orderBy: { reviewedAt: 'asc' },
    include: { srsCard: { include: { vocabEntry: { select: { lemma: true } } } } },
  });
  const headers = ['lemma', 'direction', 'grade', 'prevInterval', 'newInterval', 'durationMs', 'reviewedAt'];
  const rows = reviews.map((r) => [
    r.srsCard.vocabEntry?.lemma ?? '',
    r.direction,
    r.grade,
    r.prevInterval,
    r.newInterval,
    r.durationMs,
    r.reviewedAt.toISOString(),
  ]);
  return toCsv(headers, rows);
}
