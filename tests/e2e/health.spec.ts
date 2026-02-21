import { test, expect } from "@playwright/test";

/**
 * Health endpoint E2E tests.
 *
 * These tests run against a live server instance.
 * Start the app before running: npm run dev or docker compose up
 */
test.describe("Health Check Endpoint", () => {
  const BASE_URL = process.env.APP_URL || "http://localhost:3000";

  test("GET /api/health returns 200 with valid JSON", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      version: expect.any(String),
      uptime: expect.any(Number),
      checks: {
        database: {
          status: "ok",
          latency_ms: expect.any(Number),
        },
      },
      timestamp: expect.any(String),
    });
  });

  test("health check does not require authentication", async ({ request }) => {
    // Ensure no cookies are sent
    const response = await request.get(`${BASE_URL}/api/health`, {
      headers: { Cookie: "" },
    });
    expect(response.status()).toBe(200);
  });

  test("health check response is not cached", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const cacheControl = response.headers()["cache-control"];
    expect(cacheControl).toContain("no-store");
  });

  test("database latency is within acceptable range", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const body = await response.json();
    // Database latency should be under 100ms for a simple SELECT 1
    expect(body.checks.database.latency_ms).toBeLessThan(100);
  });
});
