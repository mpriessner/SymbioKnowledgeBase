import { test, expect } from "@playwright/test";

test.describe("Docker Compose Environment", () => {
  // These tests are specific to Docker Compose deployments.
  // Skip when running in local dev or CI without Docker.
  test.skip(!process.env.DOCKER_ENV, "Skipped: not a Docker environment");

  test("app is accessible at localhost:3000", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("app displays SymbioKnowledgeBase heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });
});
