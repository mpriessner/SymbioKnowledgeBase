import { test, expect } from "@playwright/test";

const QUICK_SWITCHER_KEY = process.platform === "darwin" ? "Meta+k" : "Control+k";

test.describe("Search UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
  });

  test("should open search dialog via sidebar Search button", async ({ page }) => {
    // Click the Search button in the sidebar
    const sidebar = page.locator("aside").first();
    await sidebar.getByRole("button", { name: /^Search/ }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const input = page.locator('input[aria-label="Search query"]');
    await expect(input).toBeVisible();
  });

  test("should navigate to page on result click", async ({ page }) => {
    await page.keyboard.press(QUICK_SWITCHER_KEY);

    const input = page.locator('input[aria-label="Search query"]');
    await expect(input).toBeVisible();
    await input.fill("test");

    await page.waitForTimeout(400);

    const firstResult = page.locator('[role="option"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
      await expect(page).toHaveURL(/\/pages\//);
    }
  });

  test("should close on Escape when input is focused", async ({ page }) => {
    await page.keyboard.press(QUICK_SWITCHER_KEY);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure input is focused before pressing Escape
    const input = page.locator('input[aria-label="Search query"]');
    await input.click();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
