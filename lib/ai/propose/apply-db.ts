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
      // Auto-enroll for spaced repetition (the learner shouldn't have to ask).
      await tx.srsCard.upsert({
        where: { vocabEntryId: row.id },
        create: { userId, vocabEntryId: row.id },
        update: {},
      });
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
        return p.targetId;
      }
      const unitId = await currentUnitId(tx, userId);
      const row = await tx.grammarTopic.create({ data: { userId, unitId, masteryScore: 0.1, ...data } });
      return row.id;
    }
    case 'HOMEWORK_CORRECTION': {
      const h = HomeworkCorrectionPayload.parse(payload);
      const hwId = p.targetId ?? h.homeworkId;
      if (!hwId) throw new ApiError('invalid_input', 'homeworkId required', 400);
      const res = await tx.homework.updateMany({
        where: { id: hwId, userId },
        data: {
          correctionsJson: json(h.corrections),
          errorSummaryJson: json(h.errorSummary),
          structuredJson: json(h.structured),
          status: 'CORRECTED',
        },
      });
      if (!res.count) throw new ApiError('not_found', 'Homework not found', 404);
      return hwId;
    }
    case 'EXERCISE_SET': {
      const e = ExerciseSetPayload.parse(payload);
      const unitId = await currentUnitId(tx, userId);
      const row = await tx.exerciseSet.create({
        data: {
          userId,
          unitId,
          title: e.title,
          sourceType: (e.sourceType ?? 'MANUAL') as SourceObjectType,
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
      const row = await tx.srsCard.upsert({
        where: { vocabEntryId: s.vocabEntryId },
        create: { userId, vocabEntryId: s.vocabEntryId, state: (s.initialState ?? 'NEW') as SrsState },
        update: {},
      });
      return row.id;
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
