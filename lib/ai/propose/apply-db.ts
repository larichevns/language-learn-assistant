/**
 * Apply dispatcher — the ONLY writer of model-proposed data. Runs in one
 * transaction: load → ownership check → status check → re-validate → typed
 * applier → stamp APPLIED. Appliers are idempotent (upsert) and owner-safe
 * (updateMany scoped by userId).
 */
import {
  type Auxiliary,
  type CefrLevel,
  type ExerciseType,
  type Formality,
  type Gender,
  type GrammarCategory,
  type GrammaticalCase,
  type PartOfSpeech,
  Prisma,
  type Proposal,
  type ReviewDirection,
  type SourceObjectType,
  type SrsState,
} from '@prisma/client';
import { prisma } from '../../db/client';
import { ApiError } from '../../api/errors';
import {
  ClassNotePayload,
  ExerciseSetPayload,
  GrammarTopicPayload,
  HomeworkCorrectionPayload,
  LearnerPreferencePayload,
  LearnerProfilePayload,
  type ProposeTargetType,
  SrsCardPayload,
  UnitPayload,
  VocabEntryPayload,
} from './tool';
import { recordAttempt } from '../../learning/record-attempt';
import { errorTypeToCategory, normalizeErrorType } from '../../learning/error-map';
import { emitTimelineEvent } from '../../learning/timeline';

type Tx = Prisma.TransactionClient;

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

async function currentUnitId(tx: Tx, userId: string): Promise<string | null> {
  const u = await tx.unit.findFirst({ where: { course: { userId }, isCurrent: true }, select: { id: true } });
  return u?.id ?? null;
}

async function applyTarget(tx: Tx, p: Proposal, userId: string): Promise<string> {
  const payload = p.payloadJson;
  switch (p.targetType as ProposeTargetType) {
    case 'VOCAB_ENTRY': {
      const v = VocabEntryPayload.parse(payload);
      const unitId = await currentUnitId(tx, userId);
      const data = {
        translationRu: v.translationRu,
        gender: (v.gender ?? null) as Gender | null,
        pluralForm: v.pluralForm ?? null,
        genitiveForm: v.genitiveForm ?? null,
        isSeparable: v.isSeparable ?? null,
        separablePrefix: v.separablePrefix ?? null,
        auxiliary: (v.auxiliary ?? null) as Auxiliary | null,
        partizipII: v.partizipII ?? null,
        praeteritum: v.praeteritum ?? null,
        presentIrregular: v.presentIrregular ?? null,
        isReflexive: v.isReflexive ?? null,
        governsCase: (v.governsCase ?? null) as GrammaticalCase | null,
        cefrLevel: (v.cefrLevel ?? null) as CefrLevel | null,
        examplesJson: json(v.examples),
        tagsJson: json(v.tags),
        unitId,
      };
      const row = await tx.vocabEntry.upsert({
        where: { userId_lemma_pos: { userId, lemma: v.lemma, pos: v.pos as PartOfSpeech } },
        create: { userId, lemma: v.lemma, pos: v.pos as PartOfSpeech, ...data },
        update: data,
      });
      // Auto-enroll separate memories (minimum-information principle):
      // DE→RU recognition + RU→DE production for every word; nouns also get a
      // "produce the article" card.
      const enrollDirections: ReviewDirection[] = ['DE_TO_RU', 'RU_TO_DE'];
      if ((v.pos as PartOfSpeech) === 'NOUN' && v.gender) enrollDirections.push('PRODUCE_ARTICLE');
      for (const direction of enrollDirections) {
        await tx.srsCard.upsert({
          where: { vocabEntryId_direction: { vocabEntryId: row.id, direction } },
          create: { userId, vocabEntryId: row.id, direction },
          update: {},
        });
      }
      return row.id;
    }
    case 'GRAMMAR_TOPIC': {
      const g = GrammarTopicPayload.parse(payload);
      const data = {
        title: g.title,
        category: g.category as GrammarCategory,
        cefrLevel: (g.cefrLevel ?? null) as CefrLevel | null,
        explanationRu: g.explanationRu,
        examplesJson: json(g.examples),
        rulesJson: json(g.rules),
        pitfallsJson: json(g.pitfalls),
      };
      if (p.op === 'UPDATE' && p.targetId) {
        const res = await tx.grammarTopic.updateMany({ where: { id: p.targetId, userId }, data });
        if (!res.count) throw new ApiError('not_found', 'Grammar topic not found', 404);
        await tx.grammarCard.upsert({ where: { grammarTopicId: p.targetId }, create: { userId, grammarTopicId: p.targetId }, update: {} });
        return p.targetId;
      }
      const unitId = await currentUnitId(tx, userId);
      const row = await tx.grammarTopic.create({ data: { userId, unitId, masteryScore: 0.1, ...data } });
      // Auto-enroll the topic for spaced production review (same FSRS engine as vocab).
      await tx.grammarCard.upsert({ where: { grammarTopicId: row.id }, create: { userId, grammarTopicId: row.id }, update: {} });
      return row.id;
    }
    case 'HOMEWORK_CORRECTION': {
      const h = HomeworkCorrectionPayload.parse(payload);
      // The model corrects one mistake per proposal and does not echo an id;
      // bind the homework server-side from the proposal's thread scope.
      let hwId = p.targetId ?? h.homeworkId ?? null;
      if (!hwId && p.threadId) {
        const thread = await tx.chatThread.findUnique({
          where: { id: p.threadId },
          select: { scopeType: true, scopeId: true },
        });
        if (thread?.scopeType === 'HOMEWORK') hwId = thread.scopeId;
      }
      if (!hwId) throw new ApiError('invalid_input', 'homeworkId required', 400);
      // One proposal = one mistake; accumulate into the homework's corrections
      // (dedupe by original|corrected) instead of overwriting on each Apply.
      const hw = await tx.homework.findFirst({ where: { id: hwId, userId }, select: { correctionsJson: true } });
      if (!hw) throw new ApiError('not_found', 'Homework not found', 404);
      const prev = Array.isArray(hw.correctionsJson) ? (hw.correctionsJson as Array<Record<string, unknown>>) : [];
      const seen = new Set(prev.map((c) => `${c.original}|${c.corrected}`));
      const added = h.corrections.filter((c) => !seen.has(`${c.original}|${c.corrected}`));
      await tx.homework.update({
        where: { id: hwId },
        data: {
          correctionsJson: [...prev, ...added] as Prisma.InputJsonValue,
          errorSummaryJson: json(h.errorSummary),
          structuredJson: json(h.structured),
          status: 'CORRECTED',
        },
      });
      // Phase 5 — close the loop: durable per-mistake rows + an Attempt that
      // drops BKT mastery on a matching grammar topic (if the learner has one).
      for (const c of added) {
        const errorType = normalizeErrorType(c.errorType);
        const category = errorTypeToCategory(errorType);
        const topic = await tx.grammarTopic.findFirst({ where: { userId, category }, select: { id: true } });
        await tx.homeworkError.create({
          data: {
            userId,
            homeworkId: hwId,
            errorType,
            original: c.original,
            corrected: c.corrected,
            explanationRu: c.explanationRu,
            grammarTopicId: topic?.id ?? null,
          },
        });
        await recordAttempt(tx, {
          userId,
          source: 'HOMEWORK',
          targetId: hwId,
          grammarTopicId: topic?.id ?? null,
          category,
          isCorrect: false,
          errorTypeJson: { errorType, original: c.original },
        });
      }
      if (added.length > 0) {
        await emitTimelineEvent(tx, {
          userId,
          type: 'HOMEWORK_CORRECTED',
          refType: 'HOMEWORK',
          refId: hwId,
          payload: { corrections: added.length },
        });
      }
      return hwId;
    }
    case 'EXERCISE_SET': {
      const e = ExerciseSetPayload.parse(payload);
      // Bind the set to its target from the proposal's thread scope (the model
      // doesn't echo ids) so graded attempts can move that topic's BKT mastery.
      let grammarTopicId: string | null = null;
      let scopedUnitId: string | null = null;
      if (p.threadId) {
        const thread = await tx.chatThread.findUnique({
          where: { id: p.threadId },
          select: { scopeType: true, scopeId: true },
        });
        if (thread?.scopeType === 'GRAMMAR_TOPIC') grammarTopicId = thread.scopeId;
        else if (thread?.scopeType === 'UNIT') scopedUnitId = thread.scopeId;
      }
      const unitId = scopedUnitId ?? (await currentUnitId(tx, userId));
      const row = await tx.exerciseSet.create({
        data: {
          userId,
          unitId,
          grammarTopicId,
          title: e.title,
          sourceType: (e.sourceType ?? (grammarTopicId ? 'GRAMMAR_TOPIC' : scopedUnitId ? 'UNIT' : 'MANUAL')) as SourceObjectType,
          cefrLevel: (e.cefrLevel ?? null) as CefrLevel | null,
          status: 'GENERATED',
          items: {
            create: e.items.map((it, i) => ({
              type: it.type as ExerciseType,
              orderIndex: i,
              prompt: it.prompt,
              promptMetaJson: json(it.promptMeta),
              optionsJson: json(it.options),
              answer: it.answer,
              acceptableAnswersJson: json(it.acceptableAnswers),
              feedbackRu: it.explanationRu ?? null,
            })),
          },
        },
      });
      return row.id;
    }
    case 'CLASS_NOTE': {
      const c = ClassNotePayload.parse(payload);
      const id = p.targetId ?? c.classNoteId;
      if (id) {
        const res = await tx.classNote.updateMany({ where: { id, userId }, data: { structuredJson: json(c.structured) } });
        if (!res.count) throw new ApiError('not_found', 'Class note not found', 404);
        return id;
      }
      const course = await tx.course.findFirst({ where: { userId, isActive: true }, select: { id: true } });
      const row = await tx.classNote.create({
        data: { userId, courseId: course?.id ?? null, rawInput: '', structuredJson: json(c.structured) },
      });
      return row.id;
    }
    case 'UNIT': {
      const u = UnitPayload.parse(payload);
      if (p.op === 'UPDATE' && p.targetId) {
        const res = await tx.unit.updateMany({
          where: { id: p.targetId, course: { userId } },
          data: {
            title: u.title,
            cefrLevel: (u.cefrLevel ?? null) as CefrLevel | null,
            premise: u.premise ?? null,
            orderIndex: u.orderIndex ?? undefined,
          },
        });
        if (!res.count) throw new ApiError('not_found', 'Unit not found', 404);
        return p.targetId;
      }
      const course = await tx.course.findFirst({ where: { userId, isActive: true }, select: { id: true } });
      if (!course) throw new ApiError('invalid_input', 'No active course', 400);
      const row = await tx.unit.create({
        data: {
          courseId: course.id,
          title: u.title,
          cefrLevel: (u.cefrLevel ?? null) as CefrLevel | null,
          premise: u.premise ?? null,
          orderIndex: u.orderIndex ?? 0,
        },
      });
      return row.id;
    }
    case 'LEARNER_PROFILE': {
      const lp = LearnerProfilePayload.parse(payload);
      const row = await tx.learnerProfile.upsert({
        where: { userId },
        create: {
          userId,
          cefrLevel: (lp.cefrLevel ?? 'A1') as CefrLevel,
          goalsJson: json(lp.goals),
          weakAreasJson: json(lp.weakAreas),
          formalityPref: (lp.formalityPref ?? 'BOTH') as Formality,
        },
        update: {
          cefrLevel: (lp.cefrLevel ?? undefined) as CefrLevel | undefined,
          goalsJson: json(lp.goals),
          weakAreasJson: json(lp.weakAreas),
          formalityPref: (lp.formalityPref ?? undefined) as Formality | undefined,
        },
      });
      return row.id;
    }
    case 'LEARNER_PREFERENCE': {
      const lp = LearnerPreferencePayload.parse(payload);
      const row = await tx.learnerPreference.upsert({
        where: { userId_key: { userId, key: lp.key } },
        create: { userId, key: lp.key, value: lp.value },
        update: { value: lp.value },
      });
      return row.id;
    }
    case 'SRS_CARD': {
      const s = SrsCardPayload.parse(payload);
      const vocab = await tx.vocabEntry.findFirst({ where: { id: s.vocabEntryId, userId }, select: { id: true } });
      if (!vocab) throw new ApiError('not_found', 'Vocab entry not found', 404);
      const dirs = (s.directions?.length ? s.directions : ['DE_TO_RU']) as ReviewDirection[];
      let firstId = '';
      for (const direction of dirs) {
        const c = await tx.srsCard.upsert({
          where: { vocabEntryId_direction: { vocabEntryId: s.vocabEntryId, direction } },
          create: { userId, vocabEntryId: s.vocabEntryId, direction, state: (s.initialState ?? 'NEW') as SrsState },
          update: {},
        });
        if (!firstId) firstId = c.id;
      }
      return firstId;
    }
    default:
      throw new ApiError('invalid_input', `Unsupported target_type: ${p.targetType}`, 400);
  }
}

export interface ApplyResult {
  entityId: string;
  targetType: ProposeTargetType;
}

export async function applyProposalDb(proposalId: string, userId: string): Promise<ApplyResult> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.proposal.findUnique({ where: { id: proposalId } });
    if (!p) throw new ApiError('not_found', 'Proposal not found', 404);
    if (p.userId !== userId) throw new ApiError('forbidden', 'Not your proposal', 403);
    if (p.status !== 'PENDING') throw new ApiError('conflict', `Proposal already ${p.status.toLowerCase()}`, 409);

    const entityId = await applyTarget(tx, p, userId);

    await tx.proposal.update({
      where: { id: p.id },
      data: { status: 'APPLIED', appliedAt: new Date(), appliedEntityId: entityId },
    });
    return { entityId, targetType: p.targetType as ProposeTargetType };
  });
}
