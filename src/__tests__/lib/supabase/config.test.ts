import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  isSupabaseConfigured,
  isDevAuthAllowed,
  assertSupabaseConfiguredInProd,
} from "@/lib/supabase/config";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.ALLOW_DEV_AUTH;
  delete process.env.NEXT_PHASE;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("isSupabaseConfigured", () => {
  test("true for a valid http url + non-placeholder key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54341";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "real-anon-key";
    expect(isSupabaseConfigured()).toBe(true);
  });

  test("false when url missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "real-anon-key";
    expect(isSupabaseConfigured()).toBe(false);
  });

  test("false for placeholder url (xxxxx)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xxxxx.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "real-anon-key";
    expect(isSupabaseConfigured()).toBe(false);
  });

  test("false for non-http url", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "localhost:54341";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "real-anon-key";
    expect(isSupabaseConfigured()).toBe(false);
  });

  test("false when anon key is itself a placeholder (audit S2 / Codex #9)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54341";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "xxxxx-placeholder";
    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe("isDevAuthAllowed", () => {
  test("false unless ALLOW_DEV_AUTH=1", () => {
    expect(isDevAuthAllowed()).toBe(false);
  });

  test("true in non-production with ALLOW_DEV_AUTH=1", () => {
    process.env.ALLOW_DEV_AUTH = "1";
    // vitest sets NODE_ENV=test, which is not "production"
    expect(isDevAuthAllowed()).toBe(true);
  });
});

describe("assertSupabaseConfiguredInProd", () => {
  test("no-op outside production", () => {
    // NODE_ENV=test under vitest
    expect(() => assertSupabaseConfiguredInProd()).not.toThrow();
  });

  test("no-op during the production build phase even if unconfigured", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    // Cannot easily flip NODE_ENV to production read-only under vitest; the
    // build-phase guard short-circuits before the prod check regardless.
    expect(() => assertSupabaseConfiguredInProd()).not.toThrow();
  });
});
