import { test, expect } from "@playwright/test";

test.describe("Home Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
  });

  test("home page loads and shows greeting", async ({ page }) => {
    await expect(
      page.getByText(/Good (morning|afternoon|evening)/)
    ).toBeVisible();
  });

  test("shows QUICK ACTIONS section with New Page, Search, View Graph", async ({
    page,
  }) => {
    await expect(page.getByText("QUICK ACTIONS")).toBeVisible();
    await expect(page.getByText("New Page")).toBeVisible();
    await expect(page.getByText("View Graph")).toBeVisible();
  });

  test("shows ALL PAGES section", async ({ page }) => {
    await expect(page.getByText("ALL PAGES")).toBeVisible();
  });

  test("clicking 'View Graph' navigates to /graph", async ({ page }) => {
    await page.getByText("View Graph").click();
    await expect(page).toHaveURL(/\/graph/);
  });
});
