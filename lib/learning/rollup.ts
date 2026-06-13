/**
 * Nightly rollup (Slice 8). Recomputes each learner's derived `weakAreasJson`
 * from the immutable logs (decayed grammar mastery + 30-day error hotspots),
 * stamps `weakAreasComputedAt`, and emits milestone TimelineEvents
 * (WEAK_AREA_CLEARED, STREAK_MILESTONE). Optionally writes a short weekly note
 * via a background LLM op (never billed). Snapshots are caches; the logs are the
 * truth — see vault/specs/phase-5-implementation-plan.md §0, §8, §13.
 *
 * The hot path stays untouched: the volatile focus-block still computes weakness
 * live each send, so a missed cron only means a slightly-stale cached list.
 */
import type { GrammarCategory, Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { executeCompletion } from '../ai/orchestrator';
import { getFeature } from '../ai/features/templates';
import { decayedMastery, NEEDS_WORK_THRESHOLD } from './decay';
import { categoryLabelRu } from './error-map';
import { computeProgressStats, type ProgressStats } from './metrics';
import { emitTimelineEvent } from './timeline';

const DAY_MS = 86_400_000;
export const WEAK_AREAS_CAP = 6;
/** An error category becomes a "weak area" only once it recurs this many times (30d). */
export const MIN_ERRORS_FOR_HOTSPOT = 3;
export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365] as const;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The note card renders plain text, but the free-tier model often ignores
 * "no markdown" and emits bold/headings/bullets/rules. Strip them deterministically
 * so the card never shows raw syntax, and flatten it to a single paragraph.
 */
export function cleanNote(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold**
    .replace(/__(.*?)__/g, '$1') // __bold__
    .replace(/(^|\n)\s*[-*_]{3,}\s*(?=\n|$)/g, '$1') // --- *** ___ rules
    .replace(/(^|\n)\s*#{1,6}\s+/g, '$1') // # headings
    .replace(/(^|\n)\s*[-*•]\s+/g, '$1') // list bullets
    .replace(/(^|\n)\s*>\s?/g, '$1') // > blockquotes
    .replace(/\*(.+?)\*/g, '$1') // residual *italics*
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ') // flatten to one paragraph
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

/**
 * Derive the ordered weak-area list: most-faded weak topics first (by decayed
 * mastery, below the needs-work threshold), then recurring error categories not
 * already named by a topic. Deduped case-insensitively, capped.
 */
export function computeWeakAreas(input: {
  topics: Array<{ title: string; decayed: number }>;
  errorHotspots: Array<{ category: GrammarCategory; count: number }>;
  cap?: number;
}): string[] {
  const cap = input.cap ?? WEAK_AREAS_CAP;
  const topicLabels = input.topics
    .filter((t) => t.decayed < NEEDS_WORK_THRESHOLD)
    .sort((a, b) => a.decayed - b.decayed)
    .map((t) => t.title.trim())
    .filter(Boolean);
  const hotspotLabels = input.errorHotspots
    .filter((h) => h.count >= MIN_ERRORS_FOR_HOTSPOT)
    .sort((a, b) => b.count - a.count)
    .map((h) => categoryLabelRu(h.category));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of [...topicLabels, ...hotspotLabels]) {
    const key = norm(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= cap) break;
  }
  return out;
}

/** Areas present last run but gone now → cleared (emit one event each). */
export function diffClearedAreas(prev: string[], next: string[]): string[] {
  const nextSet = new Set(next.map(norm));
  return prev.filter((a) => !nextSet.has(norm(a)));
}

/** Milestones at/under the current streak that haven't been emitted this streak. */
export function pickStreakMilestones(streakDays: number, alreadyEmitted: number[]): number[] {
  const emitted = new Set(alreadyEmitted);
  return STREAK_MILESTONES.filter((m) => m <= streakDays && !emitted.has(m));
}

// ── DB orchestration ────────────────────────────────────────────────────────

export interface RollupUserResult {
  userId: string;
  weakAreas: string[];
  cleared: string[];
  milestones: number[];
  noteGenerated: boolean;
}

/** Build the LLM weekly note. Best-effort: any failure (rate limit, no model) → null. */
async function generateWeeklyNote(
  userId: string,
  nativeLang: string,
  stats: ProgressStats,
  weakAreas: string[],
): Promise<string | null> {
  try {
    const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
    const topErrors = stats.errorsByCategory
      .slice(0, 3)
      .map((e) => `${categoryLabelRu(e.category as GrammarCategory)} ×${e.count}`)
      .join(', ');
    const data = [
      `learnerNativeLanguage: ${nativeLang}`,
      `streakDays: ${stats.streakDays}`,
      `reviewsLast30d: ${stats.reviews30}`,
      `gradedAttemptsLast30d: ${stats.gradeable30}`,
      `accuracyLast30d: ${pct(stats.accuracy30)}`,
      `trueRetention: ${pct(stats.trueRetention)} (n=${stats.retentionSample})`,
      `matureCards: ${stats.mature}`,
      `youngCards: ${stats.young}`,
      `totalCards: ${stats.totalCards}`,
      `weakAreas: ${weakAreas.length ? weakAreas.join('; ') : 'none'}`,
      `topRecentErrors: ${topErrors || 'none'}`,
    ].join('\n');

    const response = await executeCompletion({
      featureSlug: 'progress_summary',
      userId,
      isBackground: true,
      skipRateLimit: true,
      userMessage: '',
      systemOverride: getFeature('progress_summary').systemPrompt,
      messagesOverride: [
        {
          role: 'user',
          content:
            `Write a weekly progress note in the learner's native language (see learnerNativeLanguage below).\n` +
            `FORMAT: exactly ONE short paragraph, 2–3 sentences, ≤60 words. No greeting, no sign-off, no lists, no headings, no markdown — just flowing prose. ` +
            `Mention the streak and accuracy, name the weakest area, and end with one concrete next step. Ground every claim in these numbers only:\n${data}`,
        },
      ],
    });
    const text = response.text ? cleanNote(response.text) : '';
    return text || null;
  } catch {
    return null; // never let a flaky background call fail the rollup
  }
}

export async function runRollupForUser(userId: string, now: Date = new Date()): Promise<RollupUserResult> {
  const profile = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: { nativeLang: true, weakAreasJson: true, weakAreasComputedAt: true },
  });
  if (!profile) {
    return { userId, weakAreas: [], cleared: [], milestones: [], noteGenerated: false };
  }

  const [stats, topics] = await Promise.all([
    computeProgressStats(userId, now),
    prisma.grammarTopic.findMany({
      where: { userId },
      select: { title: true, category: true, masteryScore: true, masteryUpdatedAt: true },
    }),
  ]);

  const decayedTopics = topics.map((t) => ({
    title: t.title,
    decayed: decayedMastery(t.masteryScore, t.masteryUpdatedAt, now, t.category),
  }));
  const weakAreas = computeWeakAreas({
    topics: decayedTopics,
    errorHotspots: stats.errorsByCategory.map((e) => ({ category: e.category as GrammarCategory, count: e.count })),
  });

  // Diff only against a prior DERIVED baseline. On the first-ever rollup the old
  // value may be a manual/proposal list that the logs don't derive — clearing it
  // isn't a real "mastered" event, so we set the baseline silently this once.
  const prevWeak = (profile.weakAreasJson as string[] | null) ?? [];
  const cleared = profile.weakAreasComputedAt ? diffClearedAreas(prevWeak, weakAreas) : [];

  // Milestones already emitted within the current streak window (dedupe).
  let milestones: number[] = [];
  if (stats.streakDays > 0) {
    const since = new Date(now.getTime() - stats.streakDays * DAY_MS);
    const priorEvents = await prisma.timelineEvent.findMany({
      where: { userId, type: 'STREAK_MILESTONE', occurredAt: { gte: since } },
      select: { payloadJson: true },
    });
    const emitted = priorEvents
      .map((e) => (e.payloadJson as { days?: number } | null)?.days)
      .filter((d): d is number => typeof d === 'number');
    milestones = pickStreakMilestones(stats.streakDays, emitted);
  }

  await prisma.$transaction(async (tx) => {
    await tx.learnerProfile.update({
      where: { userId },
      data: {
        weakAreasJson: weakAreas as unknown as Prisma.InputJsonValue,
        weakAreasComputedAt: now,
      },
    });
    for (const topic of cleared) {
      await emitTimelineEvent(tx, { userId, type: 'WEAK_AREA_CLEARED', payload: { topic } });
    }
    for (const days of milestones) {
      await emitTimelineEvent(tx, { userId, type: 'STREAK_MILESTONE', payload: { days } });
    }
  });

  // Note is generated only for active learners, outside the tx (network call).
  let noteGenerated = false;
  if (stats.reviews30 + stats.gradeable30 > 0) {
    const note = await generateWeeklyNote(userId, profile.nativeLang, stats, weakAreas);
    if (note) {
      await prisma.learnerProfile.update({
        where: { userId },
        data: { progressNoteRu: note, progressNoteAt: now },
      });
      noteGenerated = true;
    }
  }

  return { userId, weakAreas, cleared, milestones, noteGenerated };
}

export interface RollupSummary {
  usersProcessed: number;
  areasCleared: number;
  milestonesEmitted: number;
  notesGenerated: number;
}

/** Process every learner profile. Sequential — keeps the background LLM calls gentle. */
export async function runRollup(now: Date = new Date()): Promise<RollupSummary> {
  const profiles = await prisma.learnerProfile.findMany({ select: { userId: true } });
  const summary: RollupSummary = { usersProcessed: 0, areasCleared: 0, milestonesEmitted: 0, notesGenerated: 0 };
  for (const p of profiles) {
    const r = await runRollupForUser(p.userId, now);
    summary.usersProcessed += 1;
    summary.areasCleared += r.cleared.length;
    summary.milestonesEmitted += r.milestones.length;
    summary.notesGenerated += r.noteGenerated ? 1 : 0;
  }
  return summary;
}
