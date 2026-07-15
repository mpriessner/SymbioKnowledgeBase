import { describe, it, expect, vi } from "vitest";
import {
  fetchPreference,
  seedPreference,
  updatePreference,
  subscribeToPreference,
  generateWriteId,
} from "@/lib/theme/themeSync";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal chainable Supabase query-builder mock. */
function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.upsert = vi.fn(() => Promise.resolve(result));
  builder.update = vi.fn(() => builder);
  return builder;
}

function makeClient(fromImpl: (table: string) => Record<string, unknown>) {
  return { from: vi.fn(fromImpl) } as unknown as SupabaseClient;
}

describe("themeSync", () => {
  describe("generateWriteId", () => {
    it("generates a non-empty, unique id per call", () => {
      const a = generateWriteId();
      const b = generateWriteId();
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(a).not.toBe(b);
    });
  });

  describe("fetchPreference", () => {
    it("returns the row when found and theme is valid", async () => {
      const row = {
        user_id: "u1",
        theme: "dark",
        updated_at: "2026-07-10T00:00:00.000Z",
        updated_by: "skb",
        write_id: "w1",
      };
      const client = makeClient(() => makeQueryBuilder({ data: row, error: null }));

      const result = await fetchPreference(client, "u1");
      expect(result).toEqual(row);
    });

    it("returns null and logs when the query errors", async () => {
      const client = makeClient(() =>
        makeQueryBuilder({ data: null, error: { message: "boom" } })
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await fetchPreference(client, "u1");
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it("returns null when no row exists", async () => {
      const client = makeClient(() => makeQueryBuilder({ data: null, error: null }));
      const result = await fetchPreference(client, "u1");
      expect(result).toBeNull();
    });
  });

  describe("seedPreference", () => {
    it("upserts insert-only (ignoreDuplicates) then re-fetches and returns the winner", async () => {
      const winnerRow = {
        user_id: "u1",
        theme: "light", // a concurrent seeder's value won the race
        updated_at: "2026-07-10T00:00:01.000Z",
        updated_by: "skb",
        write_id: "w-other",
      };

      let upsertOptions: unknown;
      const client = makeClient(() => {
        const builder = makeQueryBuilder({ data: winnerRow, error: null });
        builder.upsert = vi.fn((_row: unknown, options: unknown) => {
          upsertOptions = options;
          return Promise.resolve({ error: null });
        });
        return builder;
      });

      const result = await seedPreference(client, "u1", "dark");

      // This client seeded 'dark' but the winner (re-fetched) was 'light'.
      expect(result).toEqual(winnerRow);
      expect(upsertOptions).toEqual({ onConflict: "user_id", ignoreDuplicates: true });
    });
  });

  describe("updatePreference", () => {
    it("sends theme/updated_by/write_id but never updated_at", async () => {
      let updatePayload: Record<string, unknown> | undefined;
      const client = makeClient(() => {
        const builder = makeQueryBuilder({ data: null, error: null });
        builder.update = vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return builder;
        });
        builder.eq = vi.fn(() => Promise.resolve({ error: null }));
        return builder;
      });

      await updatePreference(client, "u1", "dark", "w1");

      expect(updatePayload).toEqual({
        theme: "dark",
        updated_by: "skb",
        write_id: "w1",
      });
      expect(updatePayload).not.toHaveProperty("updated_at");
    });

    it("throws when the update errors", async () => {
      const client = makeClient(() => {
        const builder = makeQueryBuilder({ data: null, error: null });
        builder.update = vi.fn(() => builder);
        builder.eq = vi.fn(() => Promise.resolve({ error: { message: "denied" } }));
        return builder;
      });
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(updatePreference(client, "u1", "dark", "w1")).rejects.toBeTruthy();

      spy.mockRestore();
    });
  });

  describe("subscribeToPreference", () => {
    it("subscribes exactly once and forwards valid-theme rows", () => {
      const onCallback = vi.fn();
      let registeredHandler: ((payload: { new: Record<string, unknown> }) => void) | undefined;

      const channel = {
        on: vi.fn((_event: string, _filter: unknown, handler: typeof registeredHandler) => {
          registeredHandler = handler;
          return channel;
        }),
        subscribe: vi.fn(() => channel),
      };
      const client = {
        channel: vi.fn(() => channel),
        removeChannel: vi.fn(),
      } as unknown as SupabaseClient;

      const unsubscribe = subscribeToPreference(client, "u1", onCallback);

      expect((client.channel as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect(channel.subscribe).toHaveBeenCalledTimes(1);

      registeredHandler?.({
        new: { user_id: "u1", theme: "dark", updated_at: "now", updated_by: "skb", write_id: "w1" },
      });
      expect(onCallback).toHaveBeenCalledTimes(1);

      // Invalid theme values are not forwarded.
      registeredHandler?.({ new: { theme: "not-a-theme" } });
      expect(onCallback).toHaveBeenCalledTimes(1);

      unsubscribe();
      expect((client.removeChannel as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    });
  });
});
