import { test, expect } from "@playwright/test";

test.describe("Docker Compose Environment", () => {
  test("app is accessible at localhost:3000", async ({ page }) => {
    const response = await page.goto("http://localhost:3000");
    expect(response?.status()).toBe(200);
  });

  test("app displays SymbioKnowledgeBase heading", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });
});
