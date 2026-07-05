import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Google Drive config gating (a71-12)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_REDIRECT_URI;
    delete process.env.DRIVE_TOKEN_ENC_KEY;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  const VALID_KEY_HEX = "a".repeat(64); // 32 bytes hex

  it("isDriveConfigured() is false when nothing is set", async () => {
    const { isDriveConfigured } = await import("@/lib/integrations/googleDrive/config");
    expect(isDriveConfigured()).toBe(false);
  });

  it("loadGoogleDriveConfig() returns null (feature absent) when fully unconfigured, without throwing or warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadGoogleDriveConfig } = await import("@/lib/integrations/googleDrive/config");

    expect(() => loadGoogleDriveConfig()).not.toThrow();
    expect(loadGoogleDriveConfig()).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("throws in production when partially configured (misconfiguration, not 'off')", async () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
    // client secret / redirect uri / enc key deliberately left unset
    vi.stubEnv("NODE_ENV", "production");

    const { loadGoogleDriveConfig } = await import("@/lib/integrations/googleDrive/config");
    expect(() => loadGoogleDriveConfig()).toThrow(/partially configured/i);
  });

  it("only warns (does not throw) when partially configured outside production", async () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { loadGoogleDriveConfig } = await import("@/lib/integrations/googleDrive/config");
    let result;
    expect(() => {
      result = loadGoogleDriveConfig();
    }).not.toThrow();
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("partially configured"));
    warnSpy.mockRestore();
  });

  it("throws (in any environment) when fully set but the enc key is not 32 bytes", async () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_DRIVE_REDIRECT_URI = "https://kb.example.com/api/integrations/google-drive/callback";
    process.env.DRIVE_TOKEN_ENC_KEY = "too-short";
    vi.stubEnv("NODE_ENV", "development");

    const { loadGoogleDriveConfig } = await import("@/lib/integrations/googleDrive/config");
    expect(() => loadGoogleDriveConfig()).toThrow(/32 bytes/i);
  });

  it("returns the resolved config when fully and validly configured", async () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "client-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_DRIVE_REDIRECT_URI = "https://kb.example.com/api/integrations/google-drive/callback";
    process.env.DRIVE_TOKEN_ENC_KEY = VALID_KEY_HEX;
    vi.stubEnv("NODE_ENV", "production");

    const { loadGoogleDriveConfig, isDriveConfigured } = await import(
      "@/lib/integrations/googleDrive/config"
    );
    expect(isDriveConfigured()).toBe(true);
    const config = loadGoogleDriveConfig();
    expect(config).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://kb.example.com/api/integrations/google-drive/callback",
      tokenEncKey: VALID_KEY_HEX,
    });
  });

  it("treats placeholder values (e.g. 'changeme') as unset", async () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = "changeme";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_DRIVE_REDIRECT_URI = "https://kb.example.com/callback";
    process.env.DRIVE_TOKEN_ENC_KEY = VALID_KEY_HEX;
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { isDriveConfigured } = await import("@/lib/integrations/googleDrive/config");
    expect(isDriveConfigured()).toBe(false);
    warnSpy.mockRestore();
  });
});
