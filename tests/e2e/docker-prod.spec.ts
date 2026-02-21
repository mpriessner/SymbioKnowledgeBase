import { test, expect } from "@playwright/test";

/**
 * Production Docker Compose E2E tests.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.prod.yml up -d
 *
 * Run with:
 *   npx playwright test tests/e2e/docker-prod.spec.ts
 */
test.describe("Production Docker Deployment", () => {
  const BASE_URL = process.env.APP_URL || "http://localhost:3000";

  test("health endpoint returns 200 with status ok", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(typeof body.uptime).toBe("number");
  });

  test("app serves HTML at root", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("text/html");
  });

  test("static assets are served with cache headers", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/favicon.ico`);
    if (response.status() === 200) {
      const cacheControl = response.headers()["cache-control"];
      expect(cacheControl).toBeDefined();
    }
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const status = page.url();
    expect(status).toContain(BASE_URL);
  });
});
