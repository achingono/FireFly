import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";
import { runSeed } from "../data/seed.js";

const adminRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/admin/seed — Idempotent seed for local development (admin only)
  app.post("/api/v1/admin/seed", { preHandler: [app.requireRole("admin")] }, async (_request, reply) => {
    const counts = await runSeed(prisma);
    return reply.envelope(counts);
  });
};

export default adminRoutes;
