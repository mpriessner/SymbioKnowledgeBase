import { test, expect } from "@playwright/test";

/**
 * Health (liveness) + readiness endpoint E2E tests.
 *
 * These tests run against a live server instance.
 * Start the app before running: npm run dev or docker compose up
 *
 * /api/health is a pure LIVENESS probe (no DB). /api/ready is the READINESS
 * probe that checks dependencies (database + Supabase when configured).
 */
test.describe("Health Check Endpoints", () => {
  test("GET /api/health returns 200 liveness JSON (no DB checks)", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      version: expect.any(String),
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
    // Liveness must not depend on the database.
    expect(body.checks).toBeUndefined();
  });

  test("health check does not require authentication", async ({ request }) => {
    // Ensure no cookies are sent
    const response = await request.get("/api/health", {
      headers: { Cookie: "" },
    });
    expect(response.status()).toBe(200);
  });

  test("health check response is not cached", async ({ request }) => {
    const response = await request.get("/api/health");
    const cacheControl = response.headers()["cache-control"];
    expect(cacheControl).toContain("no-store");
  });

  test("GET /api/ready reports database readiness", async ({ request }) => {
    const response = await request.get("/api/ready");
    // 200 when ready, 503 when a dependency is down — both are valid responses.
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body.checks.database.status).toBeDefined();
    expect(typeof body.checks.database.latency_ms).toBe("number");
  });

  test("readiness check does not require authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/ready", {
      headers: { Cookie: "" },
    });
    expect([200, 503]).toContain(response.status());
  });
});
