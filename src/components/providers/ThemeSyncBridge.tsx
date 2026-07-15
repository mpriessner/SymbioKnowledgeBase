"use client";

import { useEffect, useRef } from "react";
import { useSupabaseClient, useUser, useAuthLoading } from "@/components/providers/SupabaseProvider";
import {
  getSnapshot,
  getLastOrigin,
  subscribe as subscribeToStore,
  setTheme as storeSetTheme,
  type Theme,
} from "@/lib/theme/themeStore";
import {
  fetchPreference,
  seedPreference,
  updatePreference,
  subscribeToPreference,
  generateWriteId,
} from "@/lib/theme/themeSync";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CachedEntry {
  theme: Theme;
  dirty: boolean;
  /** Local timestamp (ms) of the last dirty change, for the LWW tie-break against `updated_at`. */
  updatedAtMs: number;
}

function cacheKey(userId: string): string {
  // Namespaced per user id so a shared device never inherits/seeds from
  // another signed-in user's cached preference (AC8).
  return `symbio-theme-cache:${userId}`;
}

function readCache(userId: string): CachedEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedEntry>;
    if (
      parsed &&
      (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system")
    ) {
      return {
        theme: parsed.theme,
        dirty: Boolean(parsed.dirty),
        updatedAtMs: typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : 0,
      };
    }
  } catch {
    // Ignore storage errors (private mode).
  }
  return null;
}

function writeCache(userId: string, entry: CachedEntry): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(entry));
  } catch {
    // Ignore storage errors (private mode).
  }
}

/**
 * Mounted ONCE (in the workspace layout, inside SupabaseProvider). Renders
 * nothing — it only wires the shared theme store to the cross-repo
 * `user_preferences` table, implementing sync semantics #1-#8 from the
 * theme-sync story:
 *
 *  - signed-out/unconfigured: no fetch/subscribe/write (AC5)
 *  - authed: initial reconcile (row exists / dirty-pending / absent-seed)
 *  - origin-gated outbound push (only 'user'-origin store changes)
 *  - realtime subscription with write_id echo suppression + value-equality no-op
 *  - visibilitychange refetch fallback (realtime-unavailable degrade path)
 *  - auth teardown/re-init on user change or sign-out
 */
export function ThemeSyncBridge(): null {
  const supabase = useSupabaseClient();
  const user = useUser();
  const authLoading = useAuthLoading();

  const issuedWriteIds = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const reconcileRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    initializedRef.current = false;
    issuedWriteIds.current = new Set();

    if (authLoading || !supabase || !user) {
      // Signed out / not yet configured / still resolving auth: behave
      // exactly as today, local-only (AC5).
      return;
    }

    const client: SupabaseClient = supabase;
    const userId = user.id;
    let cancelled = false;
    let unsubscribeChannel: (() => void) | null = null;

    const applyRemote = (theme: Theme, updatedAt: string) => {
      storeSetTheme(theme, "remote");
      writeCache(userId, { theme, dirty: false, updatedAtMs: new Date(updatedAt).getTime() });
    };

    const reconcile = async () => {
      const remote = await fetchPreference(client, userId);
      const cached = readCache(userId);

      if (remote) {
        if (cached?.dirty) {
          const remoteMs = new Date(remote.updated_at).getTime();
          if (remoteMs > cached.updatedAtMs) {
            // A newer remote change happened while this change was pending: remote wins.
            applyRemote(remote.theme, remote.updated_at);
          } else {
            // The pending local change is the user's most recent intent: push it.
            const writeId = generateWriteId();
            issuedWriteIds.current.add(writeId);
            try {
              await updatePreference(client, userId, cached.theme, writeId);
              writeCache(userId, { theme: cached.theme, dirty: false, updatedAtMs: Date.now() });
            } catch {
              // Keep dirty; retried on next reconcile (foreground/focus/reconnect).
            }
          }
        } else {
          applyRemote(remote.theme, remote.updated_at);
        }
      } else {
        // No remote row yet: seed from this surface's current local value
        // (existing-user migration path), insert-only so a concurrent
        // seeder from another surface loses cleanly; apply whichever wins.
        const seedTheme = cached?.theme ?? getSnapshot().theme;
        const winner = await seedPreference(client, userId, seedTheme);
        if (winner) {
          applyRemote(winner.theme, winner.updated_at);
        }
      }
    };

    reconcileRef.current = reconcile;

    void (async () => {
      await reconcile();
      if (cancelled) return;

      unsubscribeChannel = subscribeToPreference(client, userId, (row) => {
        if (row.write_id && issuedWriteIds.current.has(row.write_id)) return; // echo suppression
        if (row.theme === getSnapshot().theme) return; // value-equality no-op
        applyRemote(row.theme, row.updated_at);
      });

      if (!cancelled) {
        initializedRef.current = true;
      }
    })();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void reconcileRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      initializedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (unsubscribeChannel) {
        unsubscribeChannel();
        unsubscribeChannel = null;
      }
    };
  }, [supabase, user, authLoading]);

  // Origin-gated outbound push: only 'user'-origin store changes, and only
  // once the initial reconcile + subscription are in place (initialization
  // barrier — prevents pushing a stale local value over the remote source
  // of truth at startup).
  useEffect(() => {
    if (!supabase || !user) return;
    const client: SupabaseClient = supabase;
    const userId = user.id;

    const unsubscribeStore = subscribeToStore(() => {
      if (!initializedRef.current) return;
      if (getLastOrigin() !== "user") return;

      const theme = getSnapshot().theme;
      const nowMs = Date.now();
      writeCache(userId, { theme, dirty: true, updatedAtMs: nowMs });

      const writeId = generateWriteId();
      issuedWriteIds.current.add(writeId);
      updatePreference(client, userId, theme, writeId)
        .then(() => {
          writeCache(userId, { theme, dirty: false, updatedAtMs: nowMs });
        })
        .catch(() => {
          // Keep dirty; retried on next reconcile (foreground/focus/reconnect).
        });
    });

    return unsubscribeStore;
  }, [supabase, user]);

  return null;
}
