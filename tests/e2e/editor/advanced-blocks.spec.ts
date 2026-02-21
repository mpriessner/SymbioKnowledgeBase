import { test, expect } from "@playwright/test";

test.describe("Advanced Block Types", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test.describe("To-Do List", () => {
    test("should insert a task list via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/todo");
      await page.keyboard.press("Enter");
      await page.keyboard.type("First task");

      const taskItem = page.locator(".task-item");
      await expect(taskItem).toBeVisible();
    });

    test("should toggle checkbox on click", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/todo");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Toggle me");

      const checkbox = page.locator('.task-item input[type="checkbox"]');
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe("Toggle Block", () => {
    test("should insert a toggle block via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/toggle");
      await page.keyboard.press("Enter");

      const toggle = page.locator('[data-testid="toggle-block"]');
      await expect(toggle).toBeVisible();
    });

    test("should collapse and expand on trigger click", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/toggle");
      await page.keyboard.press("Enter");

      const trigger = page.locator('[data-testid="toggle-trigger"]');
      const content = page.locator(".toggle-content");

      // Initially expanded
      await expect(content).not.toHaveClass(/hidden/);

      // Collapse
      await trigger.click();
      await expect(content).toHaveClass(/hidden/);

      // Expand again
      await trigger.click();
      await expect(content).not.toHaveClass(/hidden/);
    });
  });

  test.describe("Callout Block", () => {
    test("should insert a callout via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/callout");
      await page.keyboard.press("Enter");

      const callout = page.locator('[data-testid="callout-block"]');
      await expect(callout).toBeVisible();
    });

    test("should change callout variant", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/callout");
      await page.keyboard.press("Enter");

      const warningBtn = page.locator('[data-testid="callout-variant-warning"]');
      await warningBtn.click();

      const callout = page.locator('[data-testid="callout-block"]');
      await expect(callout).toHaveAttribute("data-variant", "warning");
    });

    test("should change callout emoji", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/callout");
      await page.keyboard.press("Enter");

      const emojiBtn = page.locator('[data-testid="callout-emoji-btn"]');
      await emojiBtn.click();

      const picker = page.locator('[data-testid="callout-emoji-picker"]');
      await expect(picker).toBeVisible();

      const emojiOption = picker.locator("button").nth(1);
      await emojiOption.click();

      await expect(picker).not.toBeVisible();
    });
  });

  test.describe("Code Block", () => {
    test("should insert a code block via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");

      const codeBlock = page.locator('[data-testid="code-block"]');
      await expect(codeBlock).toBeVisible();
    });

    test("should change language via selector", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");

      const languageSelect = page.locator('[data-testid="code-block-language"]');
      await languageSelect.selectOption("typescript");
      await expect(languageSelect).toHaveValue("typescript");
    });

    test("should copy code to clipboard", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");
      await page.keyboard.type("const x = 42;");

      const copyBtn = page.locator('[data-testid="code-block-copy"]');
      await copyBtn.click();

      await expect(copyBtn).toContainText("Copied");
    });

    test("should insert tab as spaces inside code block", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await page.keyboard.type("indented");

      const codeBlock = page.locator('[data-testid="code-block"]');
      await expect(codeBlock).toContainText("indented");
    });
  });

  test.describe("Image Block", () => {
    test("should insert an image via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/image");

      page.on("dialog", async (dialog) => {
        await dialog.accept("https://via.placeholder.com/300");
      });
      await page.keyboard.press("Enter");

      const image = editor.locator("img");
      await expect(image).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Bookmark Block", () => {
    test("should insert a bookmark via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/bookmark");

      page.on("dialog", async (dialog) => {
        await dialog.accept("https://example.com");
      });
      await page.keyboard.press("Enter");

      const bookmark = page.locator('[data-testid="bookmark-block"]');
      await expect(bookmark).toBeVisible({ timeout: 10000 });
    });

    test("should display bookmark with fetched metadata", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/bookmark");

      page.on("dialog", async (dialog) => {
        await dialog.accept("https://example.com");
      });
      await page.keyboard.press("Enter");

      const bookmarkLink = page.locator('[data-testid="bookmark-link"]');
      await expect(bookmarkLink).toBeVisible({ timeout: 10000 });
      await expect(bookmarkLink).toHaveAttribute(
        "href",
        "https://example.com"
      );
    });
  });
});
