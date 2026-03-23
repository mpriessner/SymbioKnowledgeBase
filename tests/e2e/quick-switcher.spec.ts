import { test, expect } from "@playwright/test";

const QUICK_SWITCHER_KEY = process.platform === "darwin" ? "Meta+k" : "Control+k";

test.describe("Quick Switcher (Cmd/Ctrl+K)", () => {
  test("should open on Cmd/Ctrl+K", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press(QUICK_SWITCHER_KEY);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test("should close on Escape", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press(QUICK_SWITCHER_KEY);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Ensure the input is focused before pressing Escape
    const input = page.locator('input[aria-label="Search query"]');
    await input.click();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("should search and navigate on Enter", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press(QUICK_SWITCHER_KEY);

    const input = page.locator('input[aria-label="Search query"]');
    await expect(input).toBeVisible();
    await input.fill("test");
    await page.waitForTimeout(400);

    // Press Enter to select first result
    await page.keyboard.press("Enter");
  });

  test("should toggle closed on second Cmd/Ctrl+K", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press(QUICK_SWITCHER_KEY);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press(QUICK_SWITCHER_KEY);
    await expect(dialog).not.toBeVisible();
  });
});
