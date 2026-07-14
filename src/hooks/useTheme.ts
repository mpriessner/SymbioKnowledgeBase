"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  setTheme as storeSetTheme,
  type Theme,
} from "@/lib/theme/themeStore";

/**
 * Hook for managing the application theme.
 *
 * Public shape is unchanged from the original per-instance implementation —
 * `{ theme, resolvedTheme, setTheme }` — but it now reads from the single
 * shared module-level store in `@/lib/theme/themeStore` via
 * `useSyncExternalStore`, so every consumer (ThemeToggle, SettingsModal,
 * PreferencesSection, and the cross-repo theme-sync bridge) observes and
 * drives the same state instead of independent local state.
 */
export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((theme: Theme) => {
    storeSetTheme(theme, "user");
  }, []);

  return {
    theme: snapshot.theme,
    resolvedTheme: snapshot.resolvedTheme,
    setTheme,
  };
}
