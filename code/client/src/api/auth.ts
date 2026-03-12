import { request, setToken, getToken, ApiError, BASE_URL } from "./base";

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
  xp?: number;
  level?: number;
  streak?: number;
}

export const auth = {
  redirectToLogin: (_returnUrl?: string) => {
    window.location.href = `${BASE_URL}/auth/login`;
  },

  me: async (): Promise<User | null> => {
    try {
      const envelope = await request<User>("/auth/me");
      return envelope.data ?? null;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
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

  refresh: async (): Promise<void> => {
    const envelope = await request<{ token: string }>("/auth/refresh", {
      method: "POST",
    });
    if (envelope.data?.token) {
      setToken(envelope.data.token);
    }
  },

  logout: async (_redirectUrl?: string): Promise<void> => {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setToken(null);
    window.location.href = "/";
  },

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

  login: async (_email: string, _password: string): Promise<User | null> => {
    auth.redirectToLogin();
    return null;
  },

  register: async (_data: Record<string, unknown>): Promise<User | null> => {
    auth.redirectToLogin();
    return null;
  },
};
