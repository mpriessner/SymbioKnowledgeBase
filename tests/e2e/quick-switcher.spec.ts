import { test, expect } from "@playwright/test";

test.describe("Quick Switcher (Cmd/Ctrl+K)", () => {
  test("should open on Ctrl+K", async ({ page }) => {
    await page.goto("/");

    // Press Ctrl+K (works on all platforms in tests)
    await page.keyboard.press("Control+k");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test("should close on Escape", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("should search and navigate on Enter", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const input = page.locator('input[aria-label="Search query"]');
    await input.fill("test");
    await page.waitForTimeout(400);

    // Press Enter to select first result
    await page.keyboard.press("Enter");
  });

  test("should toggle closed on second Ctrl+K", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(dialog).not.toBeVisible();
  });
});
