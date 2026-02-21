import { test, expect } from "@playwright/test";

test.describe("Application Shell Navigation", () => {
  test("landing page loads with correct heading", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });

  test("login page renders auth form placeholder", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Log in");
  });

  test("register page renders registration placeholder", async ({ page }) => {
    await page.goto("http://localhost:3000/register");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Create your account");
  });

  test("graph page renders within workspace layout with sidebar", async ({ page }) => {
    await page.goto("http://localhost:3000/graph");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Knowledge Graph");

    // Verify sidebar is present (on desktop viewport)
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("settings page renders within workspace layout", async ({ page }) => {
    await page.goto("http://localhost:3000/settings");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Settings");
  });

  test("page route displays page ID from URL", async ({ page }) => {
    await page.goto("http://localhost:3000/pages/test-page-123");
    await expect(page.getByText("test-page-123")).toBeVisible();
  });

  test("database route displays database ID from URL", async ({ page }) => {
    await page.goto("http://localhost:3000/databases/test-db-456");
    await expect(page.getByText("test-db-456")).toBeVisible();
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("http://localhost:3000/graph");

    // Click Settings link in sidebar
    await page.getByRole("link", { name: /Settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Settings");
  });

  test("landing page 'Open Workspace' link navigates to graph", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.getByRole("link", { name: /Open Workspace/i }).click();
    await expect(page).toHaveURL(/\/graph/);
  });

  test("landing page 'Log In' link navigates to login", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.getByRole("link", { name: /Log In/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Responsive Sidebar", () => {
  test("sidebar is visible on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/graph");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("sidebar toggle button appears on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("http://localhost:3000/graph");

    // Sidebar should start collapsed on mobile — look for the toggle button
    const toggleButton = page.getByLabel("Open sidebar");
    await expect(toggleButton).toBeVisible();
  });
});
