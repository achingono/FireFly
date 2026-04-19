import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import requestIdPlugin from "./plugins/request-id.js";
import envelopePlugin from "./plugins/envelope.js";
import healthRoutes from "./routes/health.js";
import adminRoutes from "./routes/admin.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import curriculumRoutes from "./routes/curriculum.js";
import executionRoutes from "./routes/execution.js";
import masteryRoutes from "./routes/mastery.js";
import llmRoutes from "./routes/llm.js";
import analyticsRoutes from "./routes/analytics.js";
import prisma from "./config/database.js";
import redis from "./config/redis.js";
import { runCurriculumSeed } from "./data/seed.js";

const app = Fastify({
  logger: true,
  genReqId: () => "", // overridden by request-id plugin
});

async function initializeCurriculum() {
  if (!env.AUTO_SEED_DATA) {
    return;
  }

  const [conceptCount, lessonCount, exerciseCount] = await prisma.$transaction([
    prisma.concept.count(),
    prisma.lesson.count(),
    prisma.exercise.count(),
  ]);

  if (conceptCount > 0 || lessonCount > 0 || exerciseCount > 0) {
    app.log.info(
      { conceptCount, lessonCount, exerciseCount },
      "Skipping automatic curriculum initialization because data already exists"
    );
    return;
  }

  app.log.info("Curriculum is empty; seeding initial curriculum data");
  const counts = await runCurriculumSeed(prisma);
  app.log.info({ counts }, "Initial curriculum data seeded");
}

// Register plugins
await app.register(cors, {
  origin: env.CLIENT_ORIGIN.split(",").map((o) => o.trim()),
  credentials: true,
});
await app.register(requestIdPlugin);
await app.register(envelopePlugin);
await app.register(authPlugin);

// Register routes
await app.register(healthRoutes);
await app.register(adminRoutes);
await app.register(authRoutes);
await app.register(curriculumRoutes);
await app.register(executionRoutes);
await app.register(masteryRoutes);
await app.register(llmRoutes);
await app.register(analyticsRoutes);

// Global error handler
app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
  app.log.error(error);
  return reply.envelopeError(
    error.name ?? "InternalError",
    error.message ?? "An unexpected error occurred",
    undefined,
    error.statusCode ?? 500
  );
});

// Global 404 handler
app.setNotFoundHandler((_request, reply) => {
  return reply.envelopeError("NotFound", "Route not found", undefined, 404);
});

// Graceful shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
}

// Start server
try {
  await prisma.$connect();
  app.log.info("Prisma connected to PostgreSQL");
  await initializeCurriculum();

  try {
    await redis.connect();
    app.log.info("Redis connected");
  } catch (redisErr) {
    app.log.warn("Redis connection failed (non-fatal): " + (redisErr as Error).message);
  }

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Server running on http://0.0.0.0:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
