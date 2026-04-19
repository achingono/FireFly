import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { client, setToken, type User } from "@/api/client";

// Re-export User as AuthUser for backward compat
export type AuthUser = User;

export interface AuthContextType {
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  isAuthenticated: boolean;
  authError: { type: string; message?: string } | null;
  user: User | null;
  navigateToLogin: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  appLogs: unknown[];
  auth: {
    me: () => Promise<User | null>;
    logout: () => Promise<void>;
    redirectToLogin: () => void;
    login: (email: string, password: string) => Promise<User | null>;
    register: (data: Record<string, unknown>) => Promise<User | null>;
  };
}

const defaultAuth: AuthContextType = {
  isLoadingAuth: true,
  isLoadingPublicSettings: false,
  isAuthenticated: false,
  authError: null,
  user: null,
  navigateToLogin: () => {},
  logout: async () => {},
  refreshUser: async () => {},
  appLogs: [],
  auth: {
    me: async () => null,
    logout: async () => {},
    redirectToLogin: () => {},
    login: async () => null,
    register: async () => null,
  },
};

export const AuthContext = createContext<AuthContextType>(defaultAuth);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<{ type: string; message?: string } | null>(null);

  const loadUser = useCallback(async () => {
    // Session is restored via the httpOnly access_token cookie — no URL token needed.
    // The /auth/me endpoint accepts both Authorization header and cookie-based auth.
    try {
      const u = await client.auth.me();
      setUser(u);
      setAuthError(null);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const navigateToLogin = useCallback(() => {
    client.auth.redirectToLogin();
  }, []);

  const logout = useCallback(async () => {
    await client.auth.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await client.auth.me();
    if (!u) throw new Error("Authentication failed");
    setUser(u);
  }, []);

  const value: AuthContextType = useMemo(() => ({
    isLoadingAuth,
    isLoadingPublicSettings: false,
    isAuthenticated: !!user,
    authError,
    user,
    navigateToLogin,
    logout,
    refreshUser,
    appLogs: [],
    auth: {
      me: client.auth.me,
      logout,
      redirectToLogin: client.auth.redirectToLogin,
      login: client.auth.login,
      register: client.auth.register,
    },
  }), [isLoadingAuth, authError, user, navigateToLogin, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
