import { test, expect } from "@playwright/test";

test.describe("Protected Routes", () => {
  test("landing page at '/' loads and shows heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "SymbioKnowledgeBase" })
    ).toBeVisible();
  });

  test("'/login' page shows login form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in/i }).first()
    ).toBeVisible();
  });

  test("'/home' redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
  });

  test("'/settings' redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
  });
});
