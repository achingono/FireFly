// FireFly API Client — Real implementation (Wave 2B)

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

// ─── Token management ────────────────────────────────────────────

let accessToken: string | null = localStorage.getItem("firefly_token");

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem("firefly_token", token);
  } else {
    localStorage.removeItem("firefly_token");
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────

interface ApiEnvelope<T = unknown> {
  status: "success" | "error";
  code: number;
  requestId: string;
  data?: T;
  error?: { type: string; message: string; details?: unknown[] };
  meta?: Record<string, unknown>;
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Handle non-JSON responses (redirects, empty bodies)
  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!res.ok) {
      throw new ApiError("NetworkError", `HTTP ${res.status}`, res.status);
    }
    return { status: "success", code: res.status, requestId: "" } as ApiEnvelope<T>;
  }

  const envelope: ApiEnvelope<T> = await res.json();

  if (envelope.status === "error") {
    throw new ApiError(
      envelope.error?.type ?? "UnknownError",
      envelope.error?.message ?? "An error occurred",
      envelope.code
    );
  }

  return envelope;
}

export class ApiError extends Error {
  constructor(
    public type: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth API ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName?: string;
  full_name?: string;
  role: string;
  age?: number;
  ageProfile: string;
  preferences: Record<string, unknown>;
  onboarded: boolean;
  createdAt?: string;
  // Gamification fields (populated by progress system)
  xp?: number;
  level?: number;
  streak?: number;
}

const auth = {
  /** Redirect to OIDC login */
  redirectToLogin: (_returnUrl?: string) => {
    window.location.href = `${BASE_URL}/auth/login`;
  },

  /** Get current user from JWT */
  me: async (): Promise<User | null> => {
    if (!accessToken) return null;
    try {
      const envelope = await request<User>("/auth/me");
      return envelope.data ?? null;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        // Try refresh
        try {
          await auth.refresh();
          const envelope = await request<User>("/auth/me");
          return envelope.data ?? null;
        } catch {
          setToken(null);
          return null;
        }
      }
      return null;
    }
  },

  /** Refresh the access token */
  refresh: async (): Promise<void> => {
    const envelope = await request<{ token: string }>("/auth/refresh", {
      method: "POST",
    });
    if (envelope.data?.token) {
      setToken(envelope.data.token);
    }
  },

  /** Logout — clear tokens */
  logout: async (_redirectUrl?: string): Promise<void> => {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setToken(null);
    window.location.href = "/";
  },

  /** Onboard — set profile after first OIDC login */
  onboard: async (data: {
    role?: string;
    age?: number;
    ageProfile?: string;
    displayName?: string;
  }): Promise<User | null> => {
    const envelope = await request<User>("/auth/onboard", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return envelope.data ?? null;
  },

  /** Login (for compatibility — redirects to OIDC) */
  login: async (_email: string, _password: string): Promise<User | null> => {
    auth.redirectToLogin();
    return null;
  },

  /** Register (for compatibility — redirects to OIDC) */
  register: async (_data: Record<string, unknown>): Promise<User | null> => {
    auth.redirectToLogin();
    return null;
  },
};

// ─── Entities API (generic CRUD) ─────────────────────────────────

interface EntityMethods {
  list: (...args: unknown[]) => Promise<unknown[]>;
  get: (id: string) => Promise<Record<string, unknown> | null>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
}

function createEntityMethods(resource: string): EntityMethods {
  return {
    list: async (...args: unknown[]) => {
      const params = (args[0] as Record<string, string>) ?? {};
      const qs = new URLSearchParams(params).toString();
      const path = `/${resource}${qs ? `?${qs}` : ""}`;
      const envelope = await request<unknown[]>(path);
      return envelope.data ?? [];
    },
    get: async (id: string) => {
      const envelope = await request<Record<string, unknown>>(`/${resource}/${id}`);
      return envelope.data ?? null;
    },
    create: async (data: Record<string, unknown>) => {
      const envelope = await request<Record<string, unknown>>(`/${resource}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return envelope.data ?? null;
    },
  };
}

const entities = new Proxy({} as Record<string, EntityMethods>, {
  get: (_target, prop) => createEntityMethods(String(prop)),
});

// ─── AI API ───────────────────────────────────────────────────────

export interface AiRequestParams {
  prompt: string;
  mode?: string;
  userAge?: number;
  context?: string;
}

export interface AiChatParams extends AiRequestParams {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

export const ai = {
  /** Explain a trace step */
  explain: async (params: AiRequestParams): Promise<string | null> => {
    const envelope = await request<{ response: string }>("/ai/explain", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return envelope.data?.response ?? null;
  },

  /** Generate a hint for an exercise */
  hint: async (params: AiRequestParams): Promise<string | null> => {
    const envelope = await request<{ response: string }>("/ai/hint", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return envelope.data?.response ?? null;
  },

  /** General AI tutor chat */
  chat: async (params: AiChatParams): Promise<string | null> => {
    const envelope = await request<{ response: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return envelope.data?.response ?? null;
  },
};

// ─── Integrations (backward-compatible) ─────────────────────────

const integrations = {
  Core: {
    InvokeLLM: async (params: {
      prompt: string;
      response_type?: string;
    }): Promise<string | null> => {
      return ai.explain({ prompt: params.prompt });
    },
  },
};

// ─── App Logs ────────────────────────────────────────────────────

const appLogs = {
  logUserInApp: async (_pageName: string): Promise<void> => {
    // No-op for now — can be wired to analytics later
  },
};

// ─── Execution API ───────────────────────────────────────────────

export const execution = {
  /** Submit code for execution */
  run: async (data: {
    language: string;
    sourceCode: string;
    stdin?: string;
    exerciseId?: string;
  }): Promise<{ jobId: string } | null> => {
    const envelope = await request<{ jobId: string }>("/execution/run", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return envelope.data ?? null;
  },

  /** Get execution job status */
  status: async (jobId: string): Promise<Record<string, unknown> | null> => {
    const envelope = await request<Record<string, unknown>>(`/execution/jobs/${jobId}`);
    return envelope.data ?? null;
  },

  /** Get execution trace */
  trace: async (jobId: string): Promise<Record<string, unknown> | null> => {
    const envelope = await request<Record<string, unknown>>(`/execution/jobs/${jobId}/trace`);
    return envelope.data ?? null;
  },
};

// ─── Progress & Mastery API ──────────────────────────────────────

export interface MasteryConcept {
  conceptId: string;
  conceptName: string;
  sortOrder: number;
  prerequisites: string[];
  score: number;
  attempts: number;
  lastAttemptAt: string | null;
  mastered: boolean;
}

export interface MasteryMapResponse {
  userId: string;
  masteryThreshold: number;
  concepts: MasteryConcept[];
}

export interface MasteryUpdateResponse {
  conceptId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  attempts: number;
  mastered: boolean;
  justMastered: boolean;
  newlyUnlocked: string[];
  masteryThreshold: number;
}

export const progress = {
  /** Get mastery map for user */
  masteryMap: async (userId: string): Promise<MasteryMapResponse | null> => {
    const envelope = await request<MasteryMapResponse>(`/progress/${userId}`);
    return envelope.data ?? null;
  },

  /** Submit exercise attempt (BKT update) */
  submit: async (userId: string, data: {
    conceptId: string;
    correct: boolean;
    exerciseId?: string;
  }): Promise<MasteryUpdateResponse | null> => {
    const envelope = await request<MasteryUpdateResponse>(`/progress/${userId}/update`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return envelope.data ?? null;
  },
};

// ─── Exported client (backward-compatible) ───────────────────────

export const client = {
  auth,
  entities,
  integrations,
  appLogs,
};
