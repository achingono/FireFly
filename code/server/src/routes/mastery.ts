import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";
import { BKT, bktUpdate, upsertMasteryRecord, findNewlyUnlockedConcepts } from "../lib/bkt.js";

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

      const history = Array.isArray(record?.history)
        ? (record.history as Array<{ exerciseId?: string | null; correct?: boolean }>)
        : [];
      const alreadySolvedExercise = Boolean(
        exerciseId &&
        correct &&
        history.some((entry) => entry.exerciseId === exerciseId && entry.correct === true)
      );

      if (alreadySolvedExercise) {
        const currentScore = record?.score ?? BKT.pL0;
        return reply.envelope({
          conceptId,
          previousScore: currentScore,
          newScore: currentScore,
          delta: 0,
          attempts: record?.attempts ?? 0,
          mastered: currentScore >= BKT.MASTERY_THRESHOLD,
          justMastered: false,
          newlyUnlocked: [],
          masteryThreshold: BKT.MASTERY_THRESHOLD,
        });
      }

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
