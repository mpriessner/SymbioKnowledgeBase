import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  it("should throw when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow("Missing required environment variable: DATABASE_URL");
  });

  it("should throw for invalid NODE_ENV", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/test";
    vi.stubEnv("NODE_ENV", "staging");

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow('Invalid NODE_ENV: "staging"');
  });

  it("should export validated env when all variables are set", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/test";
    vi.stubEnv("NODE_ENV", "test");

    const { env } = await import("@/lib/env");

    expect(env.DATABASE_URL).toBe("postgresql://localhost/test");
    expect(env.NODE_ENV).toBe("test");
  });

  describe("NEXT_PUBLIC_PUBLIC_BASE_URL (a71-09 QR canonical base URL)", () => {
    it("throws in production when missing", async () => {
      process.env.DATABASE_URL = "postgresql://localhost/test";
      // Set the other production-gated vars so this assertion isolates the
      // failure to NEXT_PUBLIC_PUBLIC_BASE_URL specifically.
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-value";
      delete process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;
      vi.stubEnv("NODE_ENV", "production");

      await expect(async () => {
        await import("@/lib/env");
      }).rejects.toThrow("NEXT_PUBLIC_PUBLIC_BASE_URL");
    });

    it("only warns (does not throw) outside production when missing", async () => {
      process.env.DATABASE_URL = "postgresql://localhost/test";
      delete process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;
      vi.stubEnv("NODE_ENV", "development");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(import("@/lib/env")).resolves.toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NEXT_PUBLIC_PUBLIC_BASE_URL")
      );

      warnSpy.mockRestore();
    });

    it("does not warn when a real value is configured", async () => {
      process.env.DATABASE_URL = "postgresql://localhost/test";
      process.env.NEXT_PUBLIC_PUBLIC_BASE_URL = "https://kb.example.com";
      vi.stubEnv("NODE_ENV", "development");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await import("@/lib/env");

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("NEXT_PUBLIC_PUBLIC_BASE_URL")
      );

      warnSpy.mockRestore();
    });
  });
});
