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
import prisma from "./config/database.js";
import redis from "./config/redis.js";

const app = Fastify({
  logger: true,
  genReqId: () => "", // overridden by request-id plugin
});

async function start() {
  // Register plugins
  await app.register(cors, {
    origin: ["http://localhost:5173"],
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

  // Start server
  try {
    // Connect to databases
    await prisma.$connect();
    app.log.info("Prisma connected to PostgreSQL");

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
}

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

start();
