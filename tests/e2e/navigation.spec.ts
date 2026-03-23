import { test, expect } from "@playwright/test";

test.describe("Application Shell Navigation", () => {
  test("graph page renders within workspace layout with sidebar", async ({ page }) => {
    await page.goto("/graph");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Knowledge Graph");

    // Verify sidebar is present (on desktop viewport)
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("settings page renders within workspace layout", async ({ page }) => {
    await page.goto("/settings");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Settings");
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/graph");
    await page.waitForLoadState("networkidle");

    const sidebar = page.locator("aside").first();
    // Click Home in sidebar to navigate
    await sidebar.getByText("Home", { exact: true }).click();
    await expect(page).toHaveURL(/\/home/);
  });
});

test.describe("Responsive Sidebar", () => {
  test("sidebar is visible on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/graph");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("sidebar can be collapsed and expanded", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Click the collapse button in the sidebar
    const collapseButton = page.getByLabel("Collapse sidebar");
    await expect(collapseButton).toBeVisible({ timeout: 10000 });
    await collapseButton.click();

    // When collapsed, the expand button should appear
    const expandButton = page.getByLabel("Expand sidebar");
    await expect(expandButton).toBeVisible();
  });
});
