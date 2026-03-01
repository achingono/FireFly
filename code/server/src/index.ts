import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import requestIdPlugin from "./plugins/request-id.js";
import envelopePlugin from "./plugins/envelope.js";
import healthRoutes from "./routes/health.js";

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

  // Register routes
  await app.register(healthRoutes);

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
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
    process.exit(0);
  });
}

start();
