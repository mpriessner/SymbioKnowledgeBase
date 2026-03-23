import { test, expect } from "@playwright/test";

test.describe("Basic Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Click a page in the sidebar that has editor content (skip the first "Welcome" page)
    const pageItem = page.locator('[role="treeitem"]').nth(1);
    await expect(pageItem).toBeVisible({ timeout: 10000 });
    await pageItem.click();
    await page.waitForLoadState("networkidle");
  });

  test("page loads with editor area", async ({ page }) => {
    await expect(
      page.locator('[data-testid="block-editor"]')
    ).toBeVisible({ timeout: 15000 });
  });

  test("page title is visible", async ({ page }) => {
    await expect(
      page.locator('[role="textbox"][aria-label="Page title"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("editor is focusable", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await expect(editor).toBeVisible({ timeout: 15000 });
    await editor.click();
    await expect(editor).toBeFocused();
  });
});
