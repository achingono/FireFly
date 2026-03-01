import { FastifyPluginAsync } from "fastify";
import * as client from "openid-client";
import { env } from "../config/env.js";
import prisma from "../config/database.js";
import redis from "../config/redis.js";

// OIDC configuration — lazily initialized
let oidcConfig: client.Configuration | null = null;
// The public issuer URL from OIDC metadata (e.g. https://localhost:4443).
// Used to rewrite internal Docker URLs to browser-accessible URLs.
let oidcPublicIssuer: string = env.OIDC_ISSUER;

// Cookie security: derived from NODE_ENV unless explicitly overridden
const isSecureCookie = env.NODE_ENV === "production";

/** Convert a duration string like "15m" or "7d" to seconds. */
function durationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // fallback: 15 min
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 3600;
    case "d": return value * 86400;
    default: return 900;
  }
}

const ACCESS_TOKEN_MAX_AGE = durationToSeconds(env.JWT_EXPIRES_IN);
const REFRESH_TOKEN_MAX_AGE = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

async function getOidcConfig(): Promise<client.Configuration> {
  if (oidcConfig) return oidcConfig;
  const issuerUrl = new URL(env.OIDC_ISSUER);

  // When the server reaches the OIDC provider via an internal Docker network URL
  // (e.g. http://oidc:8080) but the provider advertises a public issuer URL
  // (e.g. https://localhost:4443), openid-client's discovery() will reject the
  // mismatch.  Work around this by fetching the metadata manually and using the
  // Configuration constructor, which skips issuer-URL validation.
  const wellKnown = new URL('/.well-known/openid-configuration', issuerUrl);
  const res = await fetch(wellKnown.href);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  }
  const metadata = (await res.json()) as client.ServerMetadata;

  // Store the public issuer URL from metadata for URL rewriting
  oidcPublicIssuer = metadata.issuer;

  oidcConfig = new client.Configuration(metadata, env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET);

  // In Docker, the server reaches the OIDC provider via HTTP (e.g. http://oidc:8080).
  // oauth4webapi enforces HTTPS by default; allow HTTP for internal network calls.
  client.allowInsecureRequests(oidcConfig);

  return oidcConfig;
}

// Store PKCE verifiers in Redis (or in-memory fallback)
const memoryStore = new Map<string, string>();

async function storeVerifier(state: string, codeVerifier: string): Promise<void> {
  try {
    await redis.set(`oidc:verifier:${state}`, codeVerifier, "EX", 600); // 10 min TTL
  } catch {
    memoryStore.set(state, codeVerifier);
  }
}

async function getVerifier(state: string): Promise<string | null> {
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

const authRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/v1/auth/login — Redirect to OIDC provider ───
  app.get("/api/v1/auth/login", async (_request, reply) => {
    const config = await getOidcConfig();

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    // Store code_verifier keyed by state
    await storeVerifier(state, codeVerifier);

    const redirectTo = client.buildAuthorizationUrl(config, {
      redirect_uri: env.OIDC_REDIRECT_URI,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    // Rewrite internal OIDC URL to browser-accessible public OIDC URL.
    // metadata.issuer is the public URL (e.g. https://localhost:4443) while
    // the endpoint URLs use the Docker-internal base (e.g. http://oidc:8080).
    const publicUrl = redirectTo.href.replace(env.OIDC_ISSUER, oidcPublicIssuer);

    return reply.redirect(publicUrl);
  });

  // ─── GET /api/v1/auth/callback — OIDC callback ───
  app.get<{
    Querystring: { code?: string; state?: string; error?: string; error_description?: string };
  }>("/api/v1/auth/callback", async (request, reply) => {
    const { state, error, error_description } = request.query;

    if (error) {
      return reply.envelopeError("OIDCError", error_description ?? error, undefined, 400);
    }

    if (!state) {
      return reply.envelopeError("ValidationError", "Missing state parameter", undefined, 400);
    }

    const codeVerifier = await getVerifier(state);
    if (!codeVerifier) {
      return reply.envelopeError("ValidationError", "Invalid or expired state", undefined, 400);
    }

    try {
      const config = await getOidcConfig();

      // Reconstruct the full callback URL including query params.
      // authorizationCodeGrant parses the code, state, and iss from the URL.
      const callbackUrl = new URL(`${env.OIDC_REDIRECT_URI}?${new URLSearchParams(request.query as Record<string, string>).toString()}`);

      const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
      });

      // Extract user info from ID token claims
      const claims = tokens.claims();
      const sub = claims?.sub;
      const email = (claims?.email as string) ?? `${sub}@oidc.local`;
      const displayName = (claims?.name as string) ?? (claims?.preferred_username as string) ?? email;

      if (!sub) {
        return reply.envelopeError("OIDCError", "No subject claim in ID token", undefined, 400);
      }

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { oidcSub: sub },
        update: { email, displayName },
        create: { email, displayName, oidcSub: sub, role: "student" },
      });

      // Generate our own JWT
      const accessToken = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
      );

      // Set tokens as cookies
      void reply.setCookie("access_token", accessToken, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_TOKEN_MAX_AGE,
      });

      void reply.setCookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      // Redirect to client with token (client will store it)
      const clientRedirect = new URL(`${env.CLIENT_ORIGIN}/Auth`);
      clientRedirect.searchParams.set("token", accessToken);
      clientRedirect.searchParams.set("onboarded", user.onboarded ? "true" : "false");

      return reply.redirect(clientRedirect.href);
    } catch (err) {
      app.log.error(err);
      return reply.envelopeError(
        "OIDCError",
        "Failed to exchange authorization code",
        undefined,
        500
      );
    }
  });

  // ─── GET /api/v1/auth/me — Get current user ───
  app.get("/api/v1/auth/me", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true, email: true, displayName: true, role: true,
        age: true, ageProfile: true, preferences: true, onboarded: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.envelopeError("NotFound", "User not found", undefined, 404);
    }

    return reply.envelope(user);
  });

  // ─── POST /api/v1/auth/refresh — Refresh JWT ───
  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string>)?.refresh_token;
    if (!refreshToken) {
      return reply.envelopeError("Unauthorized", "No refresh token", undefined, 401);
    }

    try {
      const payload = app.jwt.verify<{ sub: string; email: string; role: string }>(refreshToken);

      // Check user still exists
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        return reply.envelopeError("Unauthorized", "User no longer exists", undefined, 401);
      }

      const newAccessToken = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
      );

      void reply.setCookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_TOKEN_MAX_AGE,
      });

      void reply.setCookie("refresh_token", newRefreshToken, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      return reply.envelope({ token: newAccessToken });
    } catch (_err) {
      return reply.envelopeError("Unauthorized", "Invalid refresh token", undefined, 401);
    }
  });

  // ─── POST /api/v1/auth/onboard — Set profile after first login ───
  app.post<{
    Body: { role?: string; age?: number; ageProfile?: string; displayName?: string };
  }>("/api/v1/auth/onboard", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { role, age, ageProfile, displayName } = request.body ?? {};

    // Validate role
    const validRoles = ["student", "teacher", "parent"] as const;
    const validProfiles = ["fun", "balanced", "pro"] as const;

    const updateData: Record<string, unknown> = { onboarded: true };

    if (role && validRoles.includes(role as typeof validRoles[number])) {
      updateData.role = role;
    }
    if (age && typeof age === "number" && age >= 5 && age <= 99) {
      updateData.age = age;
      // Auto-set ageProfile if not specified
      if (!ageProfile) {
        if (age <= 10) updateData.ageProfile = "fun";
        else if (age <= 13) updateData.ageProfile = "balanced";
        else updateData.ageProfile = "pro";
      }
    }
    if (ageProfile && validProfiles.includes(ageProfile as typeof validProfiles[number])) {
      updateData.ageProfile = ageProfile;
    }
    if (displayName && typeof displayName === "string") {
      updateData.displayName = displayName;
    }

    const user = await prisma.user.update({
      where: { id: request.user.sub },
      data: updateData,
      select: {
        id: true, email: true, displayName: true, role: true,
        age: true, ageProfile: true, preferences: true, onboarded: true,
      },
    });

    return reply.envelope(user);
  });

  // ─── POST /api/v1/auth/logout — Clear cookies ───
  app.post("/api/v1/auth/logout", async (_request, reply) => {
    void reply.clearCookie("access_token", { path: "/" });
    void reply.clearCookie("refresh_token", { path: "/api/v1/auth" });
    return reply.envelope({ message: "Logged out" });
  });
};

export default authRoutes;
