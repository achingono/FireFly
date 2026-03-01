// ============================================================
// FireFly — Shared Constants
// ============================================================

/** Base URL for API requests (proxied via Vite in dev) */
export const API_BASE = "/api/v1";

/** Mastery threshold for concept unlock */
export const MASTERY_THRESHOLD = 0.8;

/** Default trace version */
export const TRACE_VERSION = "1.0";

/** API schema version */
export const API_SCHEMA_VERSION = "1.0";

/** Supported programming languages */
export const SUPPORTED_LANGUAGES = ["python"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Execution limits */
export const EXECUTION_LIMITS = {
  /** Max execution time in milliseconds */
  timeoutMs: 10_000,
  /** Max memory in KB */
  memoryKb: 128_000,
  /** Max output size in bytes */
  maxOutputBytes: 65_536,
} as const;

/** Rate limits (for client-side throttling hints) */
export const RATE_LIMITS = {
  /** Max code executions per minute */
  executionsPerMinute: 10,
  /** Max LLM requests per minute */
  llmRequestsPerMinute: 20,
} as const;

/** Age profile configuration */
export const AGE_PROFILES = {
  fun: {
    label: "Fun Mode",
    ageRange: "8–10",
    description: "Bright colors, mascots, confetti, story-driven worlds",
  },
  balanced: {
    label: "Balanced Mode",
    ageRange: "11–13",
    description: "Clean visuals, guided hints, progress badges",
  },
  pro: {
    label: "Pro Mode",
    ageRange: "14+",
    description: "Dark IDE theme, minimal animations, keyboard shortcuts",
  },
} as const;

/** Stepper playback speeds (ms per step) */
export const STEPPER_SPEEDS = {
  slow: 2000,
  normal: 1000,
  fast: 500,
  instant: 0,
} as const;

/** Local storage keys */
export const STORAGE_KEYS = {
  authToken: "firefly_auth_token",
  refreshToken: "firefly_refresh_token",
  userPreferences: "firefly_user_prefs",
  ageProfile: "firefly_age_profile",
} as const;

/** OIDC configuration */
export const OIDC = {
  authorizePath: "/api/v1/auth/oidc/authorize",
  callbackPath: "/auth/callback",
  logoutPath: "/api/v1/auth/oidc/logout",
} as const;
