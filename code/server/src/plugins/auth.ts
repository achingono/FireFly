import { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { env } from "../config/env.js";

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      role: string;
    };
    user: {
      sub: string;
      email: string;
      role: string;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register cookie support
  await fastify.register(cookie);

  // Register JWT
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
    cookie: {
      cookieName: "access_token",
      signed: false,
    },
  });

  // authenticate decorator — preHandler hook
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: import("fastify").FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (_err) {
        return reply.envelopeError("Unauthorized", "Invalid or missing token", undefined, 401);
      }
    }
  );

  // requireRole decorator — preHandler hook factory
  fastify.decorate(
    "requireRole",
    function (...roles: string[]) {
      return async function (request: FastifyRequest, reply: import("fastify").FastifyReply) {
        try {
          await request.jwtVerify();
        } catch (_err) {
          return reply.envelopeError("Unauthorized", "Invalid or missing token", undefined, 401);
        }
        if (!roles.includes(request.user.role)) {
          return reply.envelopeError("Forbidden", `Requires one of: ${roles.join(", ")}`, undefined, 403);
        }
      };
    }
  );
};

export default fp(authPlugin, {
  name: "auth",
  fastify: "5.x",
  dependencies: ["envelope"],
});
