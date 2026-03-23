import { test, expect } from "@playwright/test";

test.describe("Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
  });

  test("sidebar is visible on /home", async ({ page }) => {
    await expect(page.locator("aside").first()).toBeVisible();
  });

  test("sidebar has Search button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /^Search/ })
    ).toBeVisible();
  });

  test("sidebar has Home and Graph navigation", async ({ page }) => {
    const sidebar = page.locator("aside").first();
    await expect(sidebar.getByText("Home", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Graph", { exact: true })).toBeVisible();
  });

  test("sidebar has PRIVATE section with page tree", async ({ page }) => {
    await expect(page.getByText("Private")).toBeVisible();
  });

  test("clicking Graph navigates to /graph", async ({ page }) => {
    const sidebar = page.locator("aside").first();
    await sidebar.getByText("Graph", { exact: true }).click();
    await expect(page).toHaveURL(/\/graph/);
  });

  test("clicking Home navigates to /home", async ({ page }) => {
    await page.goto("/graph");
    await page.waitForLoadState("networkidle");
    const sidebar = page.locator("aside").first();
    await sidebar.getByText("Home", { exact: true }).click();
    await expect(page).toHaveURL(/\/home/);
  });
});
