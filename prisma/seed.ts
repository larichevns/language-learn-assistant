import {
  type Auxiliary,
  type CefrLevel,
  type Gender,
  type GrammarCategory,
  type PartOfSpeech,
  PrismaClient,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── AI provider + models ───────────────────────────────────────────────
  const gemini = await prisma.providerConfig.upsert({
    where: { slug: 'gemini' },
    create: {
      slug: 'gemini',
      displayName: 'Google Gemini',
      isEnabled: true,
      healthStatus: 'unknown',
      capabilitiesJson: { text: true, vision: true },
      priority: 100,
    },
    update: { isEnabled: true },
  });

  const flash = await prisma.modelConfig.upsert({
    where: { providerId_modelId: { providerId: gemini.id, modelId: 'gemini-2.5-flash' } },
    create: {
      providerId: gemini.id,
      modelId: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      isEnabled: true,
      pricingJson: { input: 0, output: 0 },
      capabilitiesJson: { vision: true, tools: true, thinking: true },
      contextWindow: 1_000_000,
    },
    update: {},
  });

  const lite = await prisma.modelConfig.upsert({
    where: { providerId_modelId: { providerId: gemini.id, modelId: 'gemini-2.5-flash-lite' } },
    create: {
      providerId: gemini.id,
      modelId: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash-Lite',
      isEnabled: true,
      pricingJson: { input: 0, output: 0 },
      capabilitiesJson: { tools: true },
      contextWindow: 1_000_000,
    },
    update: {},
  });

  // ── Features + routing (routeByFeature reads these) ─────────────────────
  const features: Array<{ slug: string; name: string; modelId: string }> = [
    { slug: 'tutor_chat', name: 'Tutor chat', modelId: flash.id },
    { slug: 'homework_correct', name: 'Homework correction', modelId: flash.id },
    { slug: 'exercise_generate', name: 'Exercise generation', modelId: flash.id },
    { slug: 'vocab_extract', name: 'Vocabulary extraction', modelId: flash.id },
    { slug: 'grammar_explain', name: 'Grammar explanation', modelId: flash.id },
    { slug: 'thread_summarize', name: 'Thread summarizer', modelId: lite.id },
    { slug: 'progress_summary', name: 'Progress summary (nightly)', modelId: flash.id },
  ];
  for (const f of features) {
    const ff = await prisma.featureFlag.upsert({
      where: { slug: f.slug },
      create: { slug: f.slug, name: f.name, isActive: true },
      update: { isActive: true },
    });
    await prisma.modelRouting.upsert({
      where: { featureId_modelId: { featureId: ff.id, modelId: f.modelId } },
      create: { featureId: ff.id, modelId: f.modelId, priority: 100, isEnabled: true },
      update: { isEnabled: true },
    });
  }

  // ── Rate limits per tier ────────────────────────────────────────────────
  const limits = [
    { tier: 'free', rpm: 8, rpd: 300, tpd: 500_000 },
    { tier: 'pro', rpm: 30, rpd: 5_000, tpd: 5_000_000 },
    { tier: 'admin', rpm: 120, rpd: 100_000, tpd: 50_000_000 },
  ];
  for (const l of limits) {
    await prisma.rateLimit.upsert({
      where: { tier_operationType: { tier: l.tier, operationType: 'all' } },
      create: {
        tier: l.tier,
        operationType: 'all',
        maxRequestsPerMinute: l.rpm,
        maxRequestsPerDay: l.rpd,
        maxTokensPerDay: l.tpd,
      },
      update: {},
    });
  }

  // ── Admin user + learner data ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lla.local' },
    create: { email: 'admin@lla.local', name: 'Admin', role: 'ADMIN', tier: 'admin', passwordHash },
    update: { role: 'ADMIN', tier: 'admin' },
  });

  await prisma.learnerProfile.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      cefrLevel: 'A2',
      goalsJson: ['Сдать Goethe B1'],
      weakAreasJson: ['der/die/das (Genus)', 'Perfekt haben/sein'],
    },
    update: {},
  });

  const course =
    (await prisma.course.findFirst({ where: { userId: admin.id } })) ??
    (await prisma.course.create({ data: { userId: admin.id, title: 'Deutsch', isActive: true } }));

  const unit =
    (await prisma.unit.findFirst({ where: { courseId: course.id, isCurrent: true } })) ??
    (await prisma.unit.create({
      data: {
        courseId: course.id,
        title: 'Lektion 5: Perfekt und Tagesablauf',
        isCurrent: true,
        cefrLevel: 'A2',
        premise: 'Perfekt mit haben/sein; Tagesablauf mit trennbaren Verben.',
      },
    }));

  const vocab: Array<{
    lemma: string;
    pos: PartOfSpeech;
    translationRu: string;
    gender?: Gender;
    pluralForm?: string;
    auxiliary?: Auxiliary;
    partizipII?: string;
    cefrLevel: CefrLevel;
  }> = [
    { lemma: 'das Haus', pos: 'NOUN', translationRu: 'дом', gender: 'DAS', pluralForm: 'Häuser', cefrLevel: 'A1' },
    { lemma: 'die Rechnung', pos: 'NOUN', translationRu: 'счёт', gender: 'DIE', pluralForm: 'Rechnungen', cefrLevel: 'A2' },
    { lemma: 'gehen', pos: 'VERB', translationRu: 'идти', auxiliary: 'SEIN', partizipII: 'gegangen', cefrLevel: 'A1' },
  ];
  for (const v of vocab) {
    await prisma.vocabEntry.upsert({
      where: { userId_lemma_pos: { userId: admin.id, lemma: v.lemma, pos: v.pos } },
      create: { userId: admin.id, unitId: unit.id, ...v },
      update: {},
    });
  }

  const grammarSeed: Array<{ title: string; category: GrammarCategory; explanationRu: string; masteryScore: number }> = [
    {
      title: 'Perfekt mit haben/sein',
      category: 'TENSE',
      explanationRu: 'Перфект = haben/sein + Partizip II. Движение/смена состояния → sein.',
      masteryScore: 0.45,
    },
  ];
  for (const g of grammarSeed) {
    const exists = await prisma.grammarTopic.findFirst({ where: { userId: admin.id, title: g.title } });
    if (!exists) {
      await prisma.grammarTopic.create({ data: { userId: admin.id, unitId: unit.id, ...g } });
    }
  }

  await prisma.homework.findFirst({ where: { userId: admin.id } }).then(async (hw) => {
    if (!hw) {
      await prisma.homework.create({
        data: {
          userId: admin.id,
          courseId: course.id,
          unitId: unit.id,
          title: 'Tagesablauf (Hausaufgabe)',
          rawInput: 'Ich habe gestern um 7 Uhr aufgestanden. Dann ich gehe zur Arbeit. Ich sehe der Chef.',
          status: 'SUBMITTED',
        },
      });
    }
  });

  console.log('✅ Seed complete. Admin login: admin@lla.local / admin12345');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
