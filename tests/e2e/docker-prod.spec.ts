import { test, expect } from "@playwright/test";

/**
 * Production Docker Compose E2E tests.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.prod.yml up -d
 *
 * Run with:
 *   DOCKER_ENV=1 npx playwright test tests/e2e/docker-prod.spec.ts
 */
test.describe("Production Docker Deployment", () => {
  // These tests are specific to Docker production deployments.
  // Skip when running in local dev or CI without Docker.
  test.skip(!process.env.DOCKER_ENV, "Skipped: not a Docker environment");

  test("health endpoint returns 200 with status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(typeof body.uptime).toBe("number");
  });

  test("app serves HTML at root", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("text/html");
  });

  test("static assets are served with cache headers", async ({ request }) => {
    const response = await request.get("/favicon.ico");
    if (response.status() === 200) {
      const cacheControl = response.headers()["cache-control"];
      expect(cacheControl).toBeDefined();
    }
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
