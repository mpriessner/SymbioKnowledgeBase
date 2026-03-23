import { test, expect } from "@playwright/test";

test.describe("Graph View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/graph");
    await page.waitForLoadState("networkidle");
  });

  test("graph page loads with 'Knowledge Graph' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Knowledge Graph" })
    ).toBeVisible();
  });

  test("graph controls panel is visible with Search, Zoom, Fit, Reset", async ({
    page,
  }) => {
    await expect(page.getByPlaceholder("Find node...")).toBeVisible();
    await expect(page.getByText("Zoom +")).toBeVisible();
    await expect(page.getByText("Zoom -")).toBeVisible();
    await expect(page.getByText("Fit").first()).toBeVisible();
    await expect(page.getByText("Reset").first()).toBeVisible();
  });

  test("node spacing and node size sliders are present", async ({ page }) => {
    await expect(page.getByText("Node spacing")).toBeVisible();
    await expect(page.getByText("Node size")).toBeVisible();
  });

  test("FILTERS section is visible", async ({ page }) => {
    await expect(page.getByText("FILTERS")).toBeVisible();
  });

  test("canvas element exists", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible();
  });
});
