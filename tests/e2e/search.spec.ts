import { test, expect } from "@playwright/test";

test.describe("Search UI", () => {
  test("should show search results as user types", async ({ page }) => {
    await page.goto("/");

    // Open search (assuming a search button exists)
    await page.click('[aria-label="Search"]');

    const input = page.locator('input[aria-label="Search query"]');
    await expect(input).toBeFocused();

    // Type a search query
    await input.fill("postgresql");

    // Wait for debounced results
    await page.waitForTimeout(400);

    // Results should appear
    const results = page.locator('[role="option"]');
    await expect(results.first()).toBeVisible();
  });

  test("should navigate to page on result click", async ({ page }) => {
    await page.goto("/");

    await page.click('[aria-label="Search"]');
    const input = page.locator('input[aria-label="Search query"]');
    await input.fill("test");

    await page.waitForTimeout(400);

    const firstResult = page.locator('[role="option"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
      await expect(page).toHaveURL(/\/pages\//);
    }
  });

  test("should close on Escape", async ({ page }) => {
    await page.goto("/");

    await page.click('[aria-label="Search"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
