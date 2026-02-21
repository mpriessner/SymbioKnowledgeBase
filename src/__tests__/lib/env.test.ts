import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow("Missing required environment variable: DATABASE_URL");
  });

  it("should throw when NEXTAUTH_SECRET is missing", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/test";
    delete process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow(
      "Missing required environment variable: NEXTAUTH_SECRET"
    );
  });

  it("should throw for invalid NODE_ENV", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/test";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "staging";

    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow('Invalid NODE_ENV: "staging"');
  });

  it("should export validated env when all variables are set", async () => {
    process.env.DATABASE_URL = "postgresql://localhost/test";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "test";

    const { env } = await import("@/lib/env");

    expect(env.DATABASE_URL).toBe("postgresql://localhost/test");
    expect(env.NEXTAUTH_SECRET).toBe("test-secret");
    expect(env.NEXTAUTH_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("test");
  });
});
