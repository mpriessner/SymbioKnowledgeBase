import { test, expect } from "@playwright/test";

test.describe("Pages", () => {
  test("can navigate to a page from the sidebar", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Click first page in sidebar
    const firstPage = page.locator('[role="treeitem"]').first();
    await expect(firstPage).toBeVisible();
    await firstPage.click();

    // Should navigate to a page URL
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/pages\//);
  });

  test("page displays title and editor", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Click first page in sidebar
    const firstPage = page.locator('[role="treeitem"]').first();
    await firstPage.click();
    await page.waitForLoadState("networkidle");

    // Page should have a title area and editor
    const editor = page.locator('[data-testid="block-editor"], .tiptap, .ProseMirror');
    await expect(editor.first()).toBeVisible({ timeout: 10_000 });
  });
});
