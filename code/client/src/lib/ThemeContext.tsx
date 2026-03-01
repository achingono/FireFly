import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AgeProfile } from "@/types";
import { STORAGE_KEYS } from "@/constants";
import { useAuth } from "@/lib/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeContextType {
  /** Current active theme (fun / balanced / pro) */
  mode: AgeProfile;
  /** Change theme and persist */
  setMode: (mode: AgeProfile) => void;
  /** True when mode === "fun" */
  isFun: boolean;
  /** True when mode === "balanced" */
  isBalanced: boolean;
  /** True when mode === "pro" */
  isPro: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MODE: AgeProfile = "balanced";

function readStoredMode(): AgeProfile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ageProfile);
    if (stored === "fun" || stored === "balanced" || stored === "pro") {
      return stored;
    }
  } catch {
    // SSR / private browsing — ignore
  }
  return null;
}

function persistMode(mode: AgeProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ageProfile, mode);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Resolve initial mode: localStorage → user.ageProfile → default
  const [mode, setModeState] = useState<AgeProfile>(() => {
    const stored = readStoredMode();
    if (stored) return stored;
    const profile = user?.ageProfile;
    if (profile === "fun" || profile === "balanced" || profile === "pro") return profile;
    return DEFAULT_MODE;
  });

  // Sync when user changes (e.g. after login / onboarding)
  useEffect(() => {
    if (user?.ageProfile && !readStoredMode()) {
      const profile = user.ageProfile;
      if (profile === "fun" || profile === "balanced" || profile === "pro") {
        setModeState(profile);
      }
    }
  }, [user?.ageProfile]);

  // Apply CSS class to <html> whenever mode changes
  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove("theme-fun", "theme-balanced", "theme-pro");

    // Add new theme class
    root.classList.add(`theme-${mode}`);

    // Also set data-theme attribute for any CSS that uses it
    root.setAttribute("data-theme", mode);

    // Fun & Balanced use light-ish themes; Pro uses dark
    if (mode === "pro") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [mode]);

  const setMode = useCallback((newMode: AgeProfile) => {
    setModeState(newMode);
    persistMode(newMode);
  }, []);

  const value: ThemeContextType = {
    mode,
    setMode,
    isFun: mode === "fun",
    isBalanced: mode === "balanced",
    isPro: mode === "pro",
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
