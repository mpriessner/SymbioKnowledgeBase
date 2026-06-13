import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { corsHeaders, resolveCorsOrigin } from "@/lib/security/cors";

const ORIGINAL = { ...process.env };

function reqWithOrigin(origin?: string): NextRequest {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new NextRequest("http://localhost:3000/api/sync/reconcile", { headers });
}

beforeEach(() => {
  process.env.SYNC_ALLOWED_ORIGINS = "https://exptube.symbio.com,https://eln.symbio.com";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("resolveCorsOrigin", () => {
  test("echoes an allowlisted origin", () => {
    expect(resolveCorsOrigin(reqWithOrigin("https://exptube.symbio.com"))).toBe(
      "https://exptube.symbio.com"
    );
  });
  test("returns null for a non-allowlisted origin", () => {
    expect(resolveCorsOrigin(reqWithOrigin("https://evil.example.com"))).toBeNull();
  });
  test("returns null when no Origin header (server-to-server)", () => {
    expect(resolveCorsOrigin(reqWithOrigin())).toBeNull();
  });
});

describe("corsHeaders — never wildcard, never literal null", () => {
  test("allowlisted origin => ACAO echoes it (not *), with Vary: Origin", () => {
    const h = corsHeaders(reqWithOrigin("https://eln.symbio.com"), {
      methods: "POST, OPTIONS",
    });
    expect(h["Access-Control-Allow-Origin"]).toBe("https://eln.symbio.com");
    expect(h["Access-Control-Allow-Origin"]).not.toBe("*");
    expect(h["Vary"]).toBe("Origin");
  });

  test("non-allowlisted origin => NO ACAO header at all (browser blocks read)", () => {
    const h = corsHeaders(reqWithOrigin("https://evil.example.com"), {
      methods: "POST, OPTIONS",
    });
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(JSON.stringify(h)).not.toContain("null");
  });

  test("no Origin => no ACAO header (server-to-server unaffected)", () => {
    const h = corsHeaders(reqWithOrigin(), { methods: "POST, OPTIONS" });
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  test("route/method-aware: methods string is passed through verbatim", () => {
    const reconcile = corsHeaders(reqWithOrigin(), { methods: "GET, POST, OPTIONS" });
    const experiments = corsHeaders(reqWithOrigin(), { methods: "POST, OPTIONS" });
    expect(reconcile["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
    expect(experiments["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
  });
});
