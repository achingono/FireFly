import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .default("postgresql://firefly@localhost:5432/firefly"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JUDGE0_URL: z.string().default("http://localhost:2358"),
  OIDC_ISSUER: z.string().default("http://localhost:8080"),
  OIDC_CLIENT_ID: z.string().default("firefly"),
  OIDC_CLIENT_SECRET: z.string().default("firefly-secret"),
  OIDC_REDIRECT_URI: z
    .string()
    .default("http://localhost:3000/api/v1/auth/callback"),
  JWT_SECRET: z.string().default("change-me-in-production"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  LLM_PROVIDER: z.string().default("lmstudio"),
  LLM_BASE_URL: z.string().default("http://localhost:1234"),
  LLM_MODEL: z.string().default("default"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  EXECUTOR_PROVIDER: z.enum(["judge0", "docker"]).default("judge0"),
  EXECUTOR_DOCKER_PYTHON_IMAGE: z.string().default("python:3.12-alpine"),
  EXECUTOR_DOCKER_NODE_IMAGE: z.string().default("node:20-alpine"),
  EXECUTOR_DOCKER_WORKDIR: z.string().default("/executor-tmp"),
  AUTO_SEED_DATA: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
