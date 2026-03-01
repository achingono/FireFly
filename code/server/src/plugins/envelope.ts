import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

interface EnvelopeMeta {
  schemaVersion?: string;
  cursor?: string;
  limit?: number;
  hasMore?: boolean;
}

interface ErrorDetail {
  field: string;
  issue: string;
}

declare module "fastify" {
  interface FastifyReply {
    envelope: (data: unknown, meta?: Partial<EnvelopeMeta>) => FastifyReply;
    envelopeError: (
      type: string,
      message: string,
      details?: ErrorDetail[],
      statusCode?: number
    ) => FastifyReply;
  }
}

const envelopePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateReply(
    "envelope",
    function (this: FastifyReply, data: unknown, meta?: Partial<EnvelopeMeta>) {
      const request = this.request as FastifyRequest;
      return this.send({
        status: "success",
        code: this.statusCode,
        requestId: request.id,
        data,
        meta: { schemaVersion: "1.0", ...meta },
      });
    }
  );

  fastify.decorateReply(
    "envelopeError",
    function (
      this: FastifyReply,
      type: string,
      message: string,
      details?: ErrorDetail[],
      statusCode?: number
    ) {
      const request = this.request as FastifyRequest;
      const code = statusCode ?? this.statusCode;
      return this.status(code).send({
        status: "error",
        code,
        requestId: request.id,
        error: { type, message, ...(details ? { details } : {}) },
      });
    }
  );
};

export default fp(envelopePlugin, {
  name: "envelope",
  fastify: "5.x",
});
