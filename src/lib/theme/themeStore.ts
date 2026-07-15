/**
 * Single module-level external store for the app theme.
 *
 * This is the ONE place that owns theme state, localStorage["symbio-theme"],
 * and the `dark` DOM class. `useTheme()` (src/hooks/useTheme.ts) is a thin
 * useSyncExternalStore wrapper around this store so every consumer (toggle,
 * settings, sync bridge) shares one source of truth instead of each hook
 * instance keeping independent React state — that would spawn duplicate
 * realtime subscriptions in the sync bridge and leave sibling instances stale.
 *
 * `origin` tracks WHO made the most recent change (`user` | `remote` |
 * `hydration`) so the cross-repo theme-sync bridge can push only user-driven
 * changes upstream and never re-push a remote-applied value (echo loop).
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type ThemeOrigin = "user" | "remote" | "hydration";

export const STORAGE_KEY = "symbio-theme";

export interface ThemeSnapshot {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
}

function isValidTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) return stored;
  } catch {
    // Ignore storage errors (private mode).
  }
  return "system";
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === "system" ? (prefersDark() ? "dark" : "light") : theme;
}

function applyDomClass(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

let currentTheme: Theme = readStoredTheme();
let currentResolved: ResolvedTheme = resolve(currentTheme);
let lastOrigin: ThemeOrigin = "hydration";

// Cached snapshot object — useSyncExternalStore compares via Object.is, so we
// must return the same reference until something actually changes.
let snapshot: ThemeSnapshot = { theme: currentTheme, resolvedTheme: currentResolved };
const serverSnapshot: ThemeSnapshot = { theme: "system", resolvedTheme: "light" };

const subscribers = new Set<() => void>();

function notify(): void {
  snapshot = { theme: currentTheme, resolvedTheme: currentResolved };
  subscribers.forEach((callback) => callback());
}

// Apply the initial resolved class client-side. The FOWT inline script
// (themeScript.ts) already painted this before hydration; this just keeps
// the store's own bookkeeping (currentResolved) consistent with the DOM.
applyDomClass(currentResolved);

let mediaQueryList: MediaQueryList | null = null;
let storageListenerAttached = false;

function handleMediaChange(): void {
  if (currentTheme !== "system") return;
  const resolved = resolve(currentTheme);
  if (resolved === currentResolved) return;
  currentResolved = resolved;
  applyDomClass(currentResolved);
  notify();
}

function handleStorageEvent(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  const value = event.newValue;
  if (!isValidTheme(value) || value === currentTheme) return;
  currentTheme = value;
  currentResolved = resolve(currentTheme);
  lastOrigin = "remote";
  applyDomClass(currentResolved);
  notify();
}

/**
 * Lazily attach the matchMedia + cross-tab storage listeners on first
 * subscription. Attaching eagerly at module-eval time would race test setup
 * (matchMedia mocks are installed after imports resolve) and browsers where
 * matchMedia isn't available yet; attaching on first `subscribe()` call is
 * both safer and cheap since this is a single app-wide store.
 */
function ensureListeners(): void {
  if (typeof window === "undefined") return;
  if (!mediaQueryList && typeof window.matchMedia === "function") {
    mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQueryList.addEventListener("change", handleMediaChange);
  }
  if (!storageListenerAttached) {
    window.addEventListener("storage", handleStorageEvent);
    storageListenerAttached = true;
  }
}

export function getSnapshot(): ThemeSnapshot {
  return snapshot;
}

export function getServerSnapshot(): ThemeSnapshot {
  return serverSnapshot;
}

export function subscribe(callback: () => void): () => void {
  ensureListeners();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** Origin of the most recent `setTheme` call — used by the sync bridge to gate outbound writes. */
export function getLastOrigin(): ThemeOrigin {
  return lastOrigin;
}

/**
 * Change the theme. `origin` records who made the change:
 * - 'user'      — toggle / settings / voice-equivalent local action (pushable upstream)
 * - 'remote'    — applied from a fetch/seed/realtime event (never re-pushed)
 * - 'hydration' — initial local load (never pushed)
 *
 * Always writes localStorage on every change (so the FOWT script stays
 * correct on next load, including for remote-applied changes), applies the
 * DOM class, and swallows storage errors (private-mode browsers).
 */
export function setTheme(theme: Theme, origin: ThemeOrigin = "user"): void {
  currentTheme = theme;
  currentResolved = resolve(theme);
  lastOrigin = origin;

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors (private mode).
  }

  applyDomClass(currentResolved);
  notify();
}

/**
 * Test-only: re-initialize the module-level store from the current
 * localStorage/matchMedia state. The store is a singleton so, unlike
 * per-instance React state, it does not naturally reset between tests in the
 * same file — call this from `beforeEach` alongside `localStorage.clear()`.
 */
export function __resetForTests(): void {
  currentTheme = readStoredTheme();
  currentResolved = resolve(currentTheme);
  lastOrigin = "hydration";
  snapshot = { theme: currentTheme, resolvedTheme: currentResolved };
  if (mediaQueryList) {
    mediaQueryList.removeEventListener("change", handleMediaChange);
  }
  mediaQueryList = null;
  applyDomClass(currentResolved);
}
