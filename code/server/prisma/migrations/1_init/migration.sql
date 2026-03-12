-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'teacher', 'parent', 'admin');

-- CreateEnum
CREATE TYPE "AgeProfile" AS ENUM ('fun', 'balanced', 'pro');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "ExecStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'timeout');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "oidcSub" TEXT,
    "role" "Role" NOT NULL DEFAULT 'student',
    "age" INTEGER,
    "ageProfile" "AgeProfile" NOT NULL DEFAULT 'balanced',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "examples" JSONB NOT NULL DEFAULT '[]',
    "media" JSONB NOT NULL DEFAULT '[]',
    "llmPromptTemplates" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conceptTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starterCode" TEXT NOT NULL DEFAULT '',
    "testCases" JSONB NOT NULL DEFAULT '[]',
    "expectedTracePatterns" JSONB NOT NULL DEFAULT '[]',
    "rubric" JSONB NOT NULL DEFAULT '{}',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',
    "language" TEXT NOT NULL DEFAULT 'python',
    "solutionCode" TEXT,
    "hints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_exercises" (
    "lessonId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lesson_exercises_pkey" PRIMARY KEY ("lessonId","exerciseId")
);

-- CreateTable
CREATE TABLE "execution_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'python',
    "sourceCode" TEXT NOT NULL,
    "stdin" TEXT,
    "status" "ExecStatus" NOT NULL DEFAULT 'queued',
    "judge0Token" TEXT,
    "stdout" TEXT,
    "stderr" TEXT,
    "exitCode" INTEGER,
    "trace" JSONB,
    "durationMs" INTEGER,
    "memoryKb" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "attempts" JSONB NOT NULL DEFAULT '[]',
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "llmInteractions" JSONB NOT NULL DEFAULT '[]',
    "masteryDelta" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "history" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "mastery_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_oidcSub_key" ON "users"("oidcSub");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_name_key" ON "concepts"("name");

-- CreateIndex
CREATE INDEX "execution_jobs_userId_idx" ON "execution_jobs"("userId");

-- CreateIndex
CREATE INDEX "execution_jobs_judge0Token_idx" ON "execution_jobs"("judge0Token");

-- CreateIndex
CREATE INDEX "learning_sessions_userId_idx" ON "learning_sessions"("userId");

-- CreateIndex
CREATE INDEX "learning_sessions_exerciseId_idx" ON "learning_sessions"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "mastery_records_userId_conceptId_key" ON "mastery_records"("userId", "conceptId");

-- CreateIndex
CREATE INDEX "mastery_records_userId_idx" ON "mastery_records"("userId");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exercises" ADD CONSTRAINT "lesson_exercises_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exercises" ADD CONSTRAINT "lesson_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_records" ADD CONSTRAINT "mastery_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_records" ADD CONSTRAINT "mastery_records_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
