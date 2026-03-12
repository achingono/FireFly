const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

let accessToken: string | null = null;

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null): void {
  accessToken = token;
}

export interface ApiEnvelope<T = unknown> {
  status: "success" | "error";
  code: number;
  requestId: string;
  data?: T;
  error?: { type: string; message: string; details?: unknown[] };
  meta?: Record<string, unknown>;
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

export async function request<T = unknown>(
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

export { BASE_URL };
