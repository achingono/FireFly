import { FastifyPluginAsync, FastifyRequest } from "fastify";
import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";

// ─── Bayesian Knowledge Tracing (BKT) Parameters ───────────────
//
// p(L₀) = prior probability of mastery (initial)                = 0.10
// p(T)  = probability of transitioning from unlearned → learned  = 0.20
// p(G)  = probability of guessing correctly (unlearned → correct)= 0.25
// p(S)  = probability of slipping (learned → incorrect)          = 0.10
//
// After observing an attempt (correct: boolean):
//   p(L_posterior) = p(L|obs) using Bayes' theorem
//   p(L_next) = p(L_posterior) + (1 - p(L_posterior)) * p(T)

const BKT = {
  pL0: 0.10, // Initial mastery probability
  pT: 0.20,  // Learn rate (transition)
  pG: 0.25,  // Guess rate
  pS: 0.10,  // Slip rate
  MASTERY_THRESHOLD: 0.80,
} as const;

/**
 * Run one BKT update step.
 * @param pL - current p(Learned)
 * @param correct - whether the student answered correctly
 * @returns updated p(Learned) after the observation
 */
function bktUpdate(pL: number, correct: boolean): number {
  // Posterior: p(L | observation)
  let pLPosterior: number;

  if (correct) {
    // p(correct) = p(L)*(1-pS) + (1-p(L))*pG
    const pCorrect = pL * (1 - BKT.pS) + (1 - pL) * BKT.pG;
    // p(L | correct) = p(L) * (1-pS) / p(correct)
    pLPosterior = (pL * (1 - BKT.pS)) / pCorrect;
  } else {
    // p(incorrect) = p(L)*pS + (1-p(L))*(1-pG)
    const pIncorrect = pL * BKT.pS + (1 - pL) * (1 - BKT.pG);
    // p(L | incorrect) = p(L) * pS / p(incorrect)
    pLPosterior = (pL * BKT.pS) / pIncorrect;
  }

  // Transition: account for learning between attempts
  const pLNext = pLPosterior + (1 - pLPosterior) * BKT.pT;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, pLNext));
}

async function upsertMasteryRecord(
  record: { id: string; history: unknown } | null,
  userId: string,
  conceptId: string,
  newScore: number,
  now: Date,
  historyEntry: Prisma.InputJsonValue
) {
  if (record) {
    const existingHistory = Array.isArray(record.history) ? record.history as unknown[] : [];
    return prisma.masteryRecord.update({
      where: { id: record.id },
      data: {
        score: newScore,
        attempts: { increment: 1 },
        lastAttemptAt: now,
        history: [...existingHistory, historyEntry] as Prisma.InputJsonValue[],
      },
    });
  }
  return prisma.masteryRecord.create({
    data: {
      userId,
      conceptId,
      score: newScore,
      attempts: 1,
      lastAttemptAt: now,
      history: [historyEntry],
    },
  });
}

async function findNewlyUnlockedConcepts(userId: string): Promise<string[]> {
  const allConcepts = await prisma.concept.findMany({
    select: { id: true, name: true, prerequisites: true },
  });
  const allMastery = await prisma.masteryRecord.findMany({
    where: { userId, score: { gte: BKT.MASTERY_THRESHOLD } },
    select: { conceptId: true },
  });
  const masteredSet = new Set(allMastery.map((m) => m.conceptId));
  const unlocked: string[] = [];
  for (const c of allConcepts) {
    const prereqs = Array.isArray(c.prerequisites) ? (c.prerequisites as string[]) : [];
    if (prereqs.length === 0 || masteredSet.has(c.id)) continue;
    if (prereqs.every((p) => masteredSet.has(p))) {
      unlocked.push(c.name);
    }
  }
  return unlocked;
}

// ─── Routes ─────────────────────────────────────────────────────

const masteryRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /api/v1/progress/:userId — mastery map ───────────────

  fastify.get<{ Params: { userId: string } }>(
    "/api/v1/progress/:userId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.params;

      // Students can only view their own progress; teachers/admins can view any
      if (request.user.role === "student" && request.user.sub !== userId) {
        return reply.envelopeError("Forbidden", "Cannot view another user's progress", undefined, 403);
      }

      const records = await prisma.masteryRecord.findMany({
        where: { userId },
        include: {
          concept: { select: { id: true, name: true, sortOrder: true } },
        },
        orderBy: { concept: { sortOrder: "asc" } },
      });

      // Also fetch all concepts to show unstarted ones as score=0
      const allConcepts = await prisma.concept.findMany({
        select: { id: true, name: true, sortOrder: true, prerequisites: true },
        orderBy: { sortOrder: "asc" },
      });

      const masteryMap = allConcepts.map((concept) => {
        const record = records.find((r) => r.conceptId === concept.id);
        return {
          conceptId: concept.id,
          conceptName: concept.name,
          sortOrder: concept.sortOrder,
          prerequisites: concept.prerequisites,
          score: record?.score ?? 0,
          attempts: record?.attempts ?? 0,
          lastAttemptAt: record?.lastAttemptAt ?? null,
          mastered: (record?.score ?? 0) >= BKT.MASTERY_THRESHOLD,
        };
      });

      return reply.envelope({
        userId,
        masteryThreshold: BKT.MASTERY_THRESHOLD,
        concepts: masteryMap,
      });
    }
  );

  // ─── POST /api/v1/progress/:userId/update — record attempt ────

  fastify.post<{
    Params: { userId: string };
    Body: { conceptId: string; correct: boolean; exerciseId?: string };
  }>(
    "/api/v1/progress/:userId/update",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.params;
      const { conceptId, correct, exerciseId } = request.body ?? {};

      // Validate
      if (!conceptId || typeof correct !== "boolean") {
        return reply.envelopeError(
          "ValidationError",
          "conceptId (string) and correct (boolean) are required",
          undefined,
          400
        );
      }

      // Only the user themselves (or teacher/admin) can submit
      if (request.user.role === "student" && request.user.sub !== userId) {
        return reply.envelopeError("Forbidden", "Cannot update another user's progress", undefined, 403);
      }

      // Verify concept exists
      const concept = await prisma.concept.findUnique({ where: { id: conceptId } });
      if (!concept) {
        return reply.envelopeError("NotFound", "Concept not found", undefined, 404);
      }

      // Get or create mastery record
      let record = await prisma.masteryRecord.findUnique({
        where: { userId_conceptId: { userId, conceptId } },
      });

      const previousScore = record?.score ?? BKT.pL0;
      const newScore = bktUpdate(previousScore, correct);
      const now = new Date();

      // Build history entry
      const historyEntry = {
        date: now.toISOString(),
        correct,
        scoreBefore: previousScore,
        scoreAfter: newScore,
        delta: newScore - previousScore,
        exerciseId: exerciseId ?? null,
      };

      record = await upsertMasteryRecord(record, userId, conceptId, newScore, now, historyEntry as Prisma.InputJsonValue);

      const mastered = newScore >= BKT.MASTERY_THRESHOLD;
      const justMastered = mastered && previousScore < BKT.MASTERY_THRESHOLD;

      const newlyUnlocked = justMastered ? await findNewlyUnlockedConcepts(userId) : [];

      return reply.envelope({
        conceptId,
        previousScore,
        newScore,
        delta: newScore - previousScore,
        attempts: record.attempts,
        mastered,
        justMastered,
        newlyUnlocked,
        masteryThreshold: BKT.MASTERY_THRESHOLD,
      });
    }
  );

  // ─── GET /api/v1/progress/:userId/concept/:conceptId — single concept mastery ─

  fastify.get<{ Params: { userId: string; conceptId: string } }>(
    "/api/v1/progress/:userId/concept/:conceptId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId, conceptId } = request.params;

      if (request.user.role === "student" && request.user.sub !== userId) {
        return reply.envelopeError("Forbidden", "Cannot view another user's progress", undefined, 403);
      }

      const record = await prisma.masteryRecord.findUnique({
        where: { userId_conceptId: { userId, conceptId } },
        include: {
          concept: { select: { id: true, name: true } },
        },
      });

      if (!record) {
        // Return default (no attempts yet)
        const concept = await prisma.concept.findUnique({
          where: { id: conceptId },
          select: { id: true, name: true },
        });
        if (!concept) {
          return reply.envelopeError("NotFound", "Concept not found", undefined, 404);
        }
        return reply.envelope({
          conceptId,
          conceptName: concept.name,
          score: 0,
          attempts: 0,
          lastAttemptAt: null,
          mastered: false,
          history: [],
        });
      }

      return reply.envelope({
        conceptId: record.conceptId,
        conceptName: (record as { concept: { name: string } }).concept.name,
        score: record.score,
        attempts: record.attempts,
        lastAttemptAt: record.lastAttemptAt,
        mastered: record.score >= BKT.MASTERY_THRESHOLD,
        history: record.history,
      });
    }
  );
};

export default masteryRoutes;
