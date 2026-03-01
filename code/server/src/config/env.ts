import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .default("postgresql://firefly:firefly_dev@localhost:5432/firefly"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JUDGE0_URL: z.string().default("http://localhost:2358"),
  OIDC_ISSUER: z.string().default("http://localhost:8080"),
  OIDC_CLIENT_ID: z.string().default("firefly"),
  OIDC_CLIENT_SECRET: z.string().default("firefly-secret"),
  OIDC_REDIRECT_URI: z
    .string()
    .default("http://localhost:5173/auth/callback"),
  JWT_SECRET: z.string().default("change-me-in-production"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  LLM_PROVIDER: z.string().default("lmstudio"),
  LLM_BASE_URL: z.string().default("http://localhost:1234"),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
