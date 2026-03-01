import { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/v1/health", async (_request, reply) => {
    return reply.envelope({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.0.1",
    });
  });
};

export default healthRoutes;
