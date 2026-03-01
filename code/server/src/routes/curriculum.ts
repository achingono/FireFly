import { FastifyPluginAsync, FastifyRequest } from "fastify";
import prisma from "../config/database.js";

const curriculumRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Concepts ────────────────────────────────────────────────

  /** GET /api/v1/concepts — list all concepts (public) */
  fastify.get("/api/v1/concepts", async (_request, reply) => {
    const concepts = await prisma.concept.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { lessons: true, masteryRecords: true } },
      },
    });
    return reply.envelope(concepts);
  });

  /** GET /api/v1/concepts/:id — single concept with lessons */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/concepts/:id",
    async (request, reply) => {
      const concept = await prisma.concept.findUnique({
        where: { id: request.params.id },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: {
              exercises: {
                orderBy: { sortOrder: "asc" },
                include: { exercise: true },
              },
            },
          },
        },
      });
      if (!concept) {
        return reply.envelopeError("NotFound", "Concept not found", undefined, 404);
      }
      return reply.envelope(concept);
    }
  );

  /** POST /api/v1/concepts — create concept (teacher/admin) */
  fastify.post<{ Body: { name: string; description?: string; tags?: string[]; prerequisites?: string[]; difficulty?: string; sortOrder?: number } }>(
    "/api/v1/concepts",
    { preHandler: [fastify.requireRole("teacher", "admin")] },
    async (request, reply) => {
      const { name, description, tags, prerequisites, difficulty, sortOrder } = request.body;
      const concept = await prisma.concept.create({
        data: {
          name,
          description,
          tags: tags ?? [],
          prerequisites: prerequisites ?? [],
          difficulty: (difficulty as "beginner" | "intermediate" | "advanced") ?? "beginner",
          sortOrder: sortOrder ?? 0,
        },
      });
      return reply.status(201).envelope(concept);
    }
  );

  // ─── Lessons ─────────────────────────────────────────────────

  /** GET /api/v1/lessons — list all lessons (public) */
  fastify.get("/api/v1/lessons", async (request, reply) => {
    const { conceptId } = request.query as { conceptId?: string };
    const where = conceptId ? { conceptId } : {};
    const lessons = await prisma.lesson.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        concept: { select: { id: true, name: true } },
        _count: { select: { exercises: true } },
      },
    });
    return reply.envelope(lessons);
  });

  /** GET /api/v1/lessons/:id — single lesson with exercises */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/lessons/:id",
    async (request, reply) => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: request.params.id },
        include: {
          concept: { select: { id: true, name: true } },
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: { exercise: true },
          },
        },
      });
      if (!lesson) {
        return reply.envelopeError("NotFound", "Lesson not found", undefined, 404);
      }
      return reply.envelope(lesson);
    }
  );

  /** POST /api/v1/lessons — create lesson (teacher/admin) */
  fastify.post<{ Body: { conceptId: string; title: string; content: string; examples?: unknown[]; sortOrder?: number } }>(
    "/api/v1/lessons",
    { preHandler: [fastify.requireRole("teacher", "admin")] },
    async (request, reply) => {
      const { conceptId, title, content, examples, sortOrder } = request.body;
      const lesson = await prisma.lesson.create({
        data: {
          conceptId,
          title,
          content,
          examples: JSON.stringify(examples ?? []),
          sortOrder: sortOrder ?? 0,
        },
      });
      return reply.status(201).envelope(lesson);
    }
  );

  // ─── Exercises ───────────────────────────────────────────────

  /** GET /api/v1/exercises — list exercises (with optional filters) */
  fastify.get("/api/v1/exercises", async (request, reply) => {
    const { conceptId, difficulty, language } = request.query as {
      conceptId?: string;
      difficulty?: string;
      language?: string;
    };

    // Build where filter
    const where: Record<string, unknown> = {};
    if (difficulty) where.difficulty = difficulty;
    if (language) where.language = language;

    // If conceptId is provided, filter exercises through the join table
    if (conceptId) {
      const lessons = await prisma.lesson.findMany({
        where: { conceptId },
        select: { id: true },
      });
      const lessonIds = lessons.map((l) => l.id);

      const lessonExercises = await prisma.lesson_Exercise.findMany({
        where: { lessonId: { in: lessonIds } },
        include: {
          exercise: true,
        },
        orderBy: { sortOrder: "asc" },
      });

      const exercises = lessonExercises.map((le) => le.exercise);
      return reply.envelope(exercises);
    }

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return reply.envelope(exercises);
  });

  /** GET /api/v1/exercises/:id — single exercise */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/exercises/:id",
    async (request, reply) => {
      const exercise = await prisma.exercise.findUnique({
        where: { id: request.params.id },
        include: {
          lessons: {
            include: {
              lesson: {
                include: {
                  concept: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      if (!exercise) {
        return reply.envelopeError("NotFound", "Exercise not found", undefined, 404);
      }
      return reply.envelope(exercise);
    }
  );

  /** POST /api/v1/exercises — create exercise (teacher/admin) */
  fastify.post<{
    Body: {
      title: string;
      description?: string;
      conceptTags?: string[];
      starterCode?: string;
      solutionCode?: string;
      testCases?: unknown[];
      hints?: string[];
      difficulty?: string;
      language?: string;
      lessonId?: string;
    };
  }>(
    "/api/v1/exercises",
    { preHandler: [fastify.requireRole("teacher", "admin")] },
    async (request, reply) => {
      const { title, description, conceptTags, starterCode, solutionCode, testCases, hints, difficulty, language, lessonId } = request.body;

      const exercise = await prisma.exercise.create({
        data: {
          title,
          description,
          conceptTags: conceptTags ?? [],
          starterCode: starterCode ?? "",
          solutionCode: solutionCode ?? null,
          testCases: JSON.stringify(testCases ?? []),
          hints: hints ?? [],
          difficulty: (difficulty as "beginner" | "intermediate" | "advanced") ?? "beginner",
          language: language ?? "python",
        },
      });
      // If lessonId provided, link exercise to lesson
      if (lessonId) {
        await prisma.lesson_Exercise.create({
          data: {
            lessonId,
            exerciseId: exercise.id,
          },
        });
      }

      return reply.status(201).envelope(exercise);
    }
  );
};

export default curriculumRoutes;
