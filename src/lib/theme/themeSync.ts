/**
 * Cross-repo theme-sync data helpers for `public.user_preferences`.
 *
 * Shared DB contract (migration lands in ExpTube, applies to the shared
 * Supabase project every surface authenticates against):
 *   user_preferences(user_id uuid PK, theme text check(light|dark|system)
 *   default system, updated_at timestamptz [trigger-stamped server clock],
 *   updated_by text, write_id uuid)
 *
 * Clients NEVER send `updated_at` — a DB trigger stamps it on every write so
 * device clock skew can never win a last-write-wins conflict. Echo
 * suppression is by `write_id`, not `updated_by` (two tabs/devices on the
 * same surface tag must still see each other's changes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Theme } from "@/lib/theme/themeStore";

const TABLE = "user_preferences";

/** Surface tag for this repo. Diagnostics only — never used for echo suppression. */
export const SURFACE_TAG = "skb" as const;

export interface UserPreferenceRow {
  user_id: string;
  theme: Theme;
  updated_at: string;
  updated_by: string | null;
  write_id: string | null;
}

function isValidTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * `user_preferences` predates the generated Supabase `Database` types in this
 * repo (the ExpTube migration + `npm run gen:types` diff is a separate,
 * coordinated PR). Casting the client to `any` for this one table keeps
 * `tsc --noEmit` green without widening any other query's types; once the
 * table exists in the generated schema this cast becomes unnecessary and can
 * be dropped in favor of `client.from("user_preferences")` directly.
 */
function table(client: SupabaseClient) {
  return (client as unknown as { from: (table: string) => any }).from(TABLE);
}

/** Generate a per-write client UUID used for realtime echo suppression. */
export function generateWriteId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older test runners).
  return `wid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Fetch the current user's preference row, or null if absent/errored. */
export async function fetchPreference(
  client: SupabaseClient,
  userId: string
): Promise<UserPreferenceRow | null> {
  const { data, error } = await table(client)
    .select("user_id, theme, updated_at, updated_by, write_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[themeSync] fetchPreference failed:", error.message);
    return null;
  }
  if (!data || !isValidTheme(data.theme)) return null;
  return data as UserPreferenceRow;
}

/**
 * Insert-only seed (`ON CONFLICT (user_id) DO NOTHING`, via
 * `ignoreDuplicates: true`) so a concurrent second seeder loses cleanly
 * instead of silently overwriting the first. Always re-fetches afterward and
 * returns whichever row actually won — the caller applies that value
 * regardless of whether this client's own seed landed.
 */
export async function seedPreference(
  client: SupabaseClient,
  userId: string,
  theme: Theme
): Promise<UserPreferenceRow | null> {
  const { error } = await table(client)
    .upsert(
      { user_id: userId, theme, updated_by: SURFACE_TAG, write_id: generateWriteId() },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[themeSync] seedPreference failed:", error.message);
  }

  return fetchPreference(client, userId);
}

/**
 * Update the row for a user-driven theme change. Never sends `updated_at`
 * (the trigger owns it). `writeId` must be recorded by the caller as
 * "issued this session" BEFORE this resolves, so an echoed realtime event
 * for this exact write can be suppressed.
 */
export async function updatePreference(
  client: SupabaseClient,
  userId: string,
  theme: Theme,
  writeId: string
): Promise<void> {
  const { error } = await table(client)
    .update({ theme, updated_by: SURFACE_TAG, write_id: writeId })
    .eq("user_id", userId);

  if (error) {
    console.error("[themeSync] updatePreference failed:", error.message);
    throw error;
  }
}

/**
 * Subscribe to realtime INSERT/UPDATE events for this user's row.
 * Returns an unsubscribe function. Callers are responsible for write_id
 * echo suppression and value-equality no-op checks on the emitted row —
 * this helper only forwards rows with a valid `theme`.
 */
export function subscribeToPreference(
  client: SupabaseClient,
  userId: string,
  onChange: (row: UserPreferenceRow) => void
): () => void {
  const channel = client
    .channel(`user_preferences:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE,
        filter: `user_id=eq.${userId}`,
      },
      (payload: { new: Record<string, unknown> }) => {
        const row = payload.new;
        if (row && isValidTheme(row.theme)) {
          onChange(row as unknown as UserPreferenceRow);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
