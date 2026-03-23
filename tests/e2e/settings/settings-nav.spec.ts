import { test, expect } from "@playwright/test";

test.describe("Settings Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("settings page loads with 'Settings' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Settings" })
    ).toBeVisible();
  });

  test("shows Profile, Preferences, Notifications under ACCOUNT", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Account" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Preferences" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Notifications" })
    ).toBeVisible();
  });

  test("shows General, People, AI Configuration under WORKSPACE", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Workspace" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "General" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "AI Configuration" })
    ).toBeVisible();
  });

  test("shows Security, API Keys under SECURITY", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Security" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("link", { name: "API Keys" })).toBeVisible();
  });

  test("profile section shows 'My profile' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "My profile" })
    ).toBeVisible();
  });

  test("profile shows 'Preferred name' input with value 'Admin'", async ({
    page,
  }) => {
    await expect(page.getByText("Preferred name")).toBeVisible();
    const nameInput = page.locator(
      'input[placeholder="Enter your name"]'
    );
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("Admin");
  });
});
