import { createContext, useContext, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  age?: number;
  xp?: number;
  level?: number;
  streak?: number;
}

export interface AuthContextType {
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  isAuthenticated: boolean;
  authError: { type: string; message?: string } | null;
  user: AuthUser | null;
  navigateToLogin: () => void;
  appLogs: unknown[];
  auth: {
    me: () => Promise<AuthUser | null>;
    logout: () => Promise<void>;
    redirectToLogin: () => void;
    login: (email: string, password: string) => Promise<AuthUser | null>;
    register: (data: Record<string, unknown>) => Promise<AuthUser | null>;
  };
}

const defaultAuth: AuthContextType = {
  isLoadingAuth: false,
  isLoadingPublicSettings: false,
  isAuthenticated: false,
  authError: null,
  user: null,
  navigateToLogin: () => {},
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
  return (
    <AuthContext.Provider value={defaultAuth}>
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
