import { test, expect } from "@playwright/test";

test.describe("Block Type Conversion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');

    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Convert this text");
  });

  test("should open block action menu from drag handle", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const menu = page.locator('[data-testid="block-action-menu"]');
    await expect(menu).toBeVisible();
  });

  test("should show Turn into submenu", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const submenu = page.locator('[data-testid="turn-into-submenu"]');
    await expect(submenu).toBeVisible();
  });

  test("should convert paragraph to Heading 2", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const heading2Option = page.locator('[data-testid="convert-to-heading2"]');
    await heading2Option.click();

    const heading = page.locator('[data-testid="block-editor"] h2');
    await expect(heading).toContainText("Convert this text");
  });

  test("should convert paragraph to bullet list", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const bulletOption = page.locator('[data-testid="convert-to-bulletList"]');
    await bulletOption.click();

    const listItem = page.locator('[data-testid="block-editor"] li');
    await expect(listItem).toContainText("Convert this text");
  });

  test("should convert heading back to paragraph", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("# ");

    const heading = page.locator('[data-testid="block-editor"] h1').first();
    await heading.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const paragraphOption = page.locator(
      '[data-testid="convert-to-paragraph"]'
    );
    await paragraphOption.click();

    const para = page.locator('[data-testid="block-editor"] p').first();
    await expect(para).toContainText("Convert this text");
  });

  test("should preserve text content during conversion", async ({ page }) => {
    const originalText = "Convert this text";

    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const heading1 = page.locator('[data-testid="convert-to-heading1"]');
    await heading1.click();

    const heading = page.locator('[data-testid="block-editor"] h1');
    await expect(heading).toContainText(originalText);
  });

  test("should close menu on Escape", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const menu = page.locator('[data-testid="block-action-menu"]');
    await expect(menu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });
});

test.describe("Block Deletion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should delete block from action menu", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("First paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second paragraph");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    const secondP = paragraphs.nth(1);
    await secondP.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const deleteBtn = page.locator('[data-testid="menu-delete"]');
    await deleteBtn.click();

    await expect(paragraphs).toHaveCount(1);
    await expect(paragraphs.first()).toContainText("First paragraph");
  });

  test("should delete block with Backspace at start of empty block", async ({
    page,
  }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("First paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs).toHaveCount(1);
  });
});

test.describe("Undo/Redo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should undo typed text with Ctrl+Z", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello world");

    await page.keyboard.press("Control+z");

    await expect(editor).not.toContainText("Hello world");
  });

  test("should redo after undo with Ctrl+Shift+Z", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello");

    await page.waitForTimeout(500);
    await page.keyboard.type(" world");

    await page.keyboard.press("Control+z");
    await expect(editor).toContainText("Hello");

    await page.keyboard.press("Control+Shift+z");
    await expect(editor).toContainText("Hello world");
  });

  test("should undo block type conversion", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("My paragraph text");

    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();
    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    await page.locator('[data-testid="menu-turn-into"]').click();
    await page.locator('[data-testid="convert-to-heading2"]').click();

    const heading = page.locator('[data-testid="block-editor"] h2');
    await expect(heading).toBeVisible();

    await page.keyboard.press("Control+z");

    const para = page.locator('[data-testid="block-editor"] p').first();
    await expect(para).toContainText("My paragraph text");
  });

  test("should undo bold formatting", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Normal text");

    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+b");

    const bold = editor.locator("strong");
    await expect(bold).toBeVisible();

    await page.keyboard.press("Control+z");

    await expect(bold).not.toBeVisible();
    await expect(editor).toContainText("Normal text");
  });

  test("should undo block deletion", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Keep this");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Delete this");

    const secondP = page.locator('[data-testid="block-editor"] p').nth(1);
    await secondP.hover();
    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();
    await page.locator('[data-testid="menu-delete"]').click();

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs).toHaveCount(1);

    await page.keyboard.press("Control+z");

    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.nth(1)).toContainText("Delete this");
  });
});
