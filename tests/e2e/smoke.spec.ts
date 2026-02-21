import { test, expect } from "@playwright/test";

test.describe("Project Initialization Smoke Tests", () => {
  test("should load the landing page at localhost:3000", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await expect(page).toHaveTitle(/SymbioKnowledgeBase/);
  });

  test("should display the application heading", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });

  test("should display the application description", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const description = page.getByText("AI-agent-first knowledge management platform");
    await expect(description).toBeVisible();
  });
});
