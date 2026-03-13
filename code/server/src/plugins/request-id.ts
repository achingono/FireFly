import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { v4 as uuidv4 } from "uuid";

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    const headerRequestId = request.headers["x-request-id"];
    if (typeof headerRequestId === "string" && headerRequestId.length > 0) {
      request.id = headerRequestId;
    } else {
      request.id = uuidv4();
    }
    reply.header("X-Request-Id", request.id);
  });
};

export default fp(requestIdPlugin, {
  name: "request-id",
  fastify: "5.x",
});
