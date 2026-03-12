import * as client from "openid-client";
import { env } from "../config/env.js";
import redis from "../config/redis.js";

let oidcConfig: client.Configuration | null = null;
let oidcPublicIssuer: string = env.OIDC_ISSUER;

export const isSecureCookie = env.NODE_ENV === "production";

function durationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 3600;
    case "d": return value * 86400;
    default: return 900;
  }
}

export const ACCESS_TOKEN_MAX_AGE = durationToSeconds(env.JWT_EXPIRES_IN);
export const REFRESH_TOKEN_MAX_AGE = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

export async function getOidcConfig(): Promise<client.Configuration> {
  if (oidcConfig) return oidcConfig;
  const issuerUrl = new URL(env.OIDC_ISSUER);

  const wellKnown = new URL("/.well-known/openid-configuration", issuerUrl);
  const res = await fetch(wellKnown.href);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  }
  const metadata = (await res.json()) as client.ServerMetadata;

  oidcPublicIssuer = metadata.issuer;

  oidcConfig = new client.Configuration(metadata, env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET);

  client.allowInsecureRequests(oidcConfig);

  return oidcConfig;
}

export function getOidcPublicIssuer(): string {
  return oidcPublicIssuer;
}

const memoryStore = new Map<string, string>();

export async function storeVerifier(state: string, codeVerifier: string): Promise<void> {
  try {
    await redis.set(`oidc:verifier:${state}`, codeVerifier, "EX", 600);
  } catch {
    memoryStore.set(state, codeVerifier);
  }
}

export async function getVerifier(state: string): Promise<string | null> {
  try {
    const val = await redis.get(`oidc:verifier:${state}`);
    if (val) {
      await redis.del(`oidc:verifier:${state}`);
      return val;
    }
  } catch {
    // fallback to memory
  }
  const val = memoryStore.get(state) ?? null;
  if (val) memoryStore.delete(state);
  return val;
}
