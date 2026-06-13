-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "Formality" AS ENUM ('DU', 'SIE', 'BOTH');

-- CreateEnum
CREATE TYPE "PartOfSpeech" AS ENUM ('NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PRONOUN', 'PREPOSITION', 'CONJUNCTION', 'ARTICLE', 'NUMERAL', 'INTERJECTION', 'PHRASE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('DER', 'DIE', 'DAS');

-- CreateEnum
CREATE TYPE "Auxiliary" AS ENUM ('HABEN', 'SEIN');

-- CreateEnum
CREATE TYPE "GrammaticalCase" AS ENUM ('NOMINATIV', 'AKKUSATIV', 'DATIV', 'GENITIV');

-- CreateEnum
CREATE TYPE "SrsState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'LAPSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('DE_TO_RU', 'RU_TO_DE', 'PRODUCE_ARTICLE', 'PRODUCE_PLURAL');

-- CreateEnum
CREATE TYPE "GrammarCategory" AS ENUM ('ARTICLE', 'CASE', 'TENSE', 'VERB_CONJUGATION', 'SEPARABLE_VERB', 'MODAL_VERB', 'PREPOSITION', 'PRONOUN', 'ADJECTIVE_DECLENSION', 'WORD_ORDER', 'NEGATION', 'SUBJUNCTIVE', 'PASSIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'STRUCTURED', 'CORRECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HomeworkSource" AS ENUM ('TEXT', 'IMAGE', 'VOICE');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('CLOZE', 'TRANSLATION_RU_DE', 'TRANSLATION_DE_RU', 'CONJUGATION', 'ARTICLE_GENDER', 'PLURAL_FORM', 'CASE_DECLENSION', 'SEPARABLE_VERB', 'PERFEKT_FORM', 'MCQ', 'WORD_ORDER', 'MATCHING');

-- CreateEnum
CREATE TYPE "ExerciseStatus" AS ENUM ('GENERATED', 'IN_PROGRESS', 'GRADED');

-- CreateEnum
CREATE TYPE "SourceObjectType" AS ENUM ('UNIT', 'GRAMMAR_TOPIC', 'VOCAB_LIST', 'HOMEWORK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('GLOBAL', 'COURSE', 'UNIT', 'VOCAB_ENTRY', 'VOCAB_LIST', 'GRAMMAR_TOPIC', 'HOMEWORK', 'CLASS_NOTE', 'EXERCISE_SET');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProposalTargetType" AS ENUM ('VOCAB_ENTRY', 'GRAMMAR_TOPIC', 'HOMEWORK_CORRECTION', 'CLASS_NOTE', 'EXERCISE_SET', 'UNIT', 'LEARNER_PROFILE', 'LEARNER_PREFERENCE', 'SRS_CARD');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'REFINED', 'DISCARDED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProposalOp" AS ENUM ('CREATE', 'UPDATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "tier" TEXT NOT NULL DEFAULT 'free',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Deutsch',
    "targetLang" TEXT NOT NULL DEFAULT 'de',
    "nativeLang" TEXT NOT NULL DEFAULT 'ru',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nativeLang" TEXT NOT NULL DEFAULT 'ru',
    "targetLang" TEXT NOT NULL DEFAULT 'de',
    "cefrLevel" "CefrLevel" NOT NULL DEFAULT 'A1',
    "formalityPref" "Formality" NOT NULL DEFAULT 'BOTH',
    "goalsJson" JSONB,
    "weakAreasJson" JSONB,
    "explainInNative" BOOLEAN NOT NULL DEFAULT true,
    "dailyGoalCards" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "cefrLevel" "CefrLevel",
    "premise" TEXT,
    "summary" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT,
    "lemma" TEXT NOT NULL,
    "pos" "PartOfSpeech" NOT NULL,
    "translationRu" TEXT NOT NULL,
    "gender" "Gender",
    "pluralForm" TEXT,
    "genitiveForm" TEXT,
    "isSeparable" BOOLEAN DEFAULT false,
    "separablePrefix" TEXT,
    "auxiliary" "Auxiliary",
    "partizipII" TEXT,
    "presentIrregular" TEXT,
    "praeteritum" TEXT,
    "isReflexive" BOOLEAN DEFAULT false,
    "governsCase" "GrammaticalCase",
    "examplesJson" JSONB,
    "tagsJson" JSONB,
    "cefrLevel" "CefrLevel",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabUnitIndex" (
    "id" TEXT NOT NULL,
    "vocabEntryId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "VocabUnitIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SrsCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabEntryId" TEXT NOT NULL,
    "state" "SrsState" NOT NULL DEFAULT 'NEW',
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SrsCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "srsCardId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "direction" "ReviewDirection" NOT NULL DEFAULT 'DE_TO_RU',
    "prevInterval" INTEGER NOT NULL,
    "newInterval" INTEGER NOT NULL,
    "prevEase" DOUBLE PRECISION NOT NULL,
    "newEase" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarTopic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT,
    "title" TEXT NOT NULL,
    "category" "GrammarCategory" NOT NULL,
    "cefrLevel" "CefrLevel",
    "explanationRu" TEXT NOT NULL,
    "examplesJson" JSONB,
    "rulesJson" JSONB,
    "pitfallsJson" JSONB,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "unitId" TEXT,
    "title" TEXT,
    "source" "HomeworkSource" NOT NULL DEFAULT 'TEXT',
    "rawInput" TEXT NOT NULL,
    "imageUrl" TEXT,
    "structuredJson" JSONB,
    "correctionsJson" JSONB,
    "errorSummaryJson" JSONB,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "unitId" TEXT,
    "title" TEXT,
    "rawInput" TEXT NOT NULL,
    "structuredJson" JSONB,
    "lessonDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT,
    "grammarTopicId" TEXT,
    "homeworkId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" "SourceObjectType" NOT NULL DEFAULT 'MANUAL',
    "cefrLevel" "CefrLevel",
    "status" "ExerciseStatus" NOT NULL DEFAULT 'GENERATED',
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseItem" (
    "id" TEXT NOT NULL,
    "exerciseSetId" TEXT NOT NULL,
    "vocabEntryId" TEXT,
    "type" "ExerciseType" NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "promptMetaJson" JSONB,
    "optionsJson" JSONB,
    "answer" TEXT NOT NULL,
    "acceptableAnswersJson" JSONB,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "feedbackRu" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ExerciseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT,
    "title" TEXT,
    "threadSummary" TEXT,
    "summaryWatermark" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metaJson" JSONB,
    "isSummarized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "targetType" "ProposalTargetType" NOT NULL,
    "targetId" TEXT,
    "targetField" TEXT,
    "op" "ProposalOp" NOT NULL DEFAULT 'CREATE',
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "appliedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "capabilitiesJson" JSONB,
    "healthStatus" TEXT NOT NULL DEFAULT 'unknown',
    "healthCheckedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pricingJson" JSONB,
    "capabilitiesJson" JSONB,
    "contextWindow" INTEGER,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "operationType" TEXT NOT NULL DEFAULT 'text_completion',
    "description" TEXT,
    "inputSchemaJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelRouting" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "configOverrideJson" JSONB,

    CONSTRAINT "ModelRouting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "promptType" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "variablesJson" JSONB,
    "parametersJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVariable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "varType" TEXT NOT NULL,
    "enumValuesJson" JSONB,
    "validationRegex" TEXT,
    "defaultValue" TEXT,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "featureSlug" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "providerSlug" TEXT,
    "modelId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "thinkingTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "isBackground" BOOLEAN NOT NULL DEFAULT false,
    "requestMetaJson" JSONB,
    "responseMetaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "operationType" TEXT NOT NULL DEFAULT 'all',
    "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 5,
    "maxRequestsPerDay" INTEGER NOT NULL DEFAULT 200,
    "maxTokensPerDay" INTEGER NOT NULL DEFAULT 500000,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "featureSlug" TEXT,
    "severity" TEXT NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "contentPreview" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Course_userId_isActive_idx" ON "Course"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_userId_key" ON "LearnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerPreference_userId_key_key" ON "LearnerPreference"("userId", "key");

-- CreateIndex
CREATE INDEX "Unit_courseId_orderIndex_idx" ON "Unit"("courseId", "orderIndex");

-- CreateIndex
CREATE INDEX "Unit_courseId_isCurrent_idx" ON "Unit"("courseId", "isCurrent");

-- CreateIndex
CREATE INDEX "VocabEntry_userId_unitId_idx" ON "VocabEntry"("userId", "unitId");

-- CreateIndex
CREATE INDEX "VocabEntry_userId_pos_idx" ON "VocabEntry"("userId", "pos");

-- CreateIndex
CREATE UNIQUE INDEX "VocabEntry_userId_lemma_pos_key" ON "VocabEntry"("userId", "lemma", "pos");

-- CreateIndex
CREATE INDEX "VocabUnitIndex_unitId_idx" ON "VocabUnitIndex"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabUnitIndex_vocabEntryId_unitId_key" ON "VocabUnitIndex"("vocabEntryId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "SrsCard_vocabEntryId_key" ON "SrsCard"("vocabEntryId");

-- CreateIndex
CREATE INDEX "SrsCard_userId_dueAt_idx" ON "SrsCard"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "SrsCard_userId_state_idx" ON "SrsCard"("userId", "state");

-- CreateIndex
CREATE INDEX "Review_srsCardId_reviewedAt_idx" ON "Review"("srsCardId", "reviewedAt");

-- CreateIndex
CREATE INDEX "GrammarTopic_userId_category_idx" ON "GrammarTopic"("userId", "category");

-- CreateIndex
CREATE INDEX "GrammarTopic_userId_unitId_idx" ON "GrammarTopic"("userId", "unitId");

-- CreateIndex
CREATE INDEX "Homework_userId_status_idx" ON "Homework"("userId", "status");

-- CreateIndex
CREATE INDEX "Homework_userId_courseId_idx" ON "Homework"("userId", "courseId");

-- CreateIndex
CREATE INDEX "ClassNote_userId_courseId_idx" ON "ClassNote"("userId", "courseId");

-- CreateIndex
CREATE INDEX "ExerciseSet_userId_status_idx" ON "ExerciseSet"("userId", "status");

-- CreateIndex
CREATE INDEX "ExerciseItem_exerciseSetId_orderIndex_idx" ON "ExerciseItem"("exerciseSetId", "orderIndex");

-- CreateIndex
CREATE INDEX "ChatThread_userId_scopeType_idx" ON "ChatThread"("userId", "scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_userId_scopeType_scopeId_key" ON "ChatThread"("userId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_userId_status_idx" ON "Proposal"("userId", "status");

-- CreateIndex
CREATE INDEX "Proposal_threadId_idx" ON "Proposal"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_slug_key" ON "ProviderConfig"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_providerId_modelId_key" ON "ModelConfig"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_slug_key" ON "FeatureFlag"("slug");

-- CreateIndex
CREATE INDEX "ModelRouting_featureId_priority_idx" ON "ModelRouting"("featureId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRouting_featureId_modelId_key" ON "ModelRouting"("featureId", "modelId");

-- CreateIndex
CREATE INDEX "PromptTemplate_featureId_isActive_idx" ON "PromptTemplate"("featureId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_featureId_promptType_version_key" ON "PromptTemplate"("featureId", "promptType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVariable_key_key" ON "PromptVariable"("key");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_featureSlug_createdAt_idx" ON "UsageEvent"("featureSlug", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_requestId_idx" ON "UsageEvent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_tier_operationType_key" ON "RateLimit"("tier", "operationType");

-- CreateIndex
CREATE INDEX "AbuseEvent_userId_createdAt_idx" ON "AbuseEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProfile" ADD CONSTRAINT "LearnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerPreference" ADD CONSTRAINT "LearnerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabUnitIndex" ADD CONSTRAINT "VocabUnitIndex_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SrsCard" ADD CONSTRAINT "SrsCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SrsCard" ADD CONSTRAINT "SrsCard_vocabEntryId_fkey" FOREIGN KEY ("vocabEntryId") REFERENCES "VocabEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_srsCardId_fkey" FOREIGN KEY ("srsCardId") REFERENCES "SrsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarTopic" ADD CONSTRAINT "GrammarTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarTopic" ADD CONSTRAINT "GrammarTopic_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_grammarTopicId_fkey" FOREIGN KEY ("grammarTopicId") REFERENCES "GrammarTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseItem" ADD CONSTRAINT "ExerciseItem_exerciseSetId_fkey" FOREIGN KEY ("exerciseSetId") REFERENCES "ExerciseSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseItem" ADD CONSTRAINT "ExerciseItem_vocabEntryId_fkey" FOREIGN KEY ("vocabEntryId") REFERENCES "VocabEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelConfig" ADD CONSTRAINT "ModelConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRouting" ADD CONSTRAINT "ModelRouting_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRouting" ADD CONSTRAINT "ModelRouting_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseEvent" ADD CONSTRAINT "AbuseEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
