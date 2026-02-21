import { test, expect } from "@playwright/test";

test.describe("Block Drag-and-Drop Reordering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');

    // Create some content to work with
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("First paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Third paragraph");
  });

  test("should show drag handle on block hover", async ({ page }) => {
    const firstParagraph = page.locator('[data-testid="block-editor"] p').first();
    await firstParagraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await expect(dragHandle).toBeVisible();
  });

  test("should hide drag handle when not hovering a block", async ({
    page,
  }) => {
    await page.mouse.move(0, 0);

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await expect(dragHandle).not.toBeVisible();
  });

  test("should show drop indicator during drag", async ({ page }) => {
    const firstParagraph = page.locator('[data-testid="block-editor"] p').first();
    await firstParagraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    const handleBox = await dragHandle.boundingBox();
    const thirdParagraph = page.locator('[data-testid="block-editor"] p').nth(2);
    const thirdBox = await thirdParagraph.boundingBox();

    if (handleBox && thirdBox) {
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2
      );
      await page.mouse.down();

      await page.mouse.move(
        thirdBox.x + thirdBox.width / 2,
        thirdBox.y + thirdBox.height / 2,
        { steps: 5 }
      );

      const dropIndicator = page.locator('[data-testid="drop-indicator"]');
      await expect(dropIndicator).toBeVisible();

      await page.mouse.up();
    }
  });

  test("should reorder blocks via drag-and-drop", async ({ page }) => {
    const paragraphs = page.locator('[data-testid="block-editor"] p');
    const firstText = await paragraphs.nth(0).textContent();
    const thirdText = await paragraphs.nth(2).textContent();

    expect(firstText).toBe("First paragraph");
    expect(thirdText).toBe("Third paragraph");

    const firstP = paragraphs.nth(0);
    await firstP.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    const handleBox = await dragHandle.boundingBox();
    const thirdP = paragraphs.nth(2);
    const thirdBox = await thirdP.boundingBox();

    if (handleBox && thirdBox) {
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        thirdBox.x + thirdBox.width / 2,
        thirdBox.y + thirdBox.height,
        { steps: 10 }
      );
      await page.mouse.up();
    }

    const reorderedParagraphs = page.locator(
      '[data-testid="block-editor"] p'
    );
    await expect(reorderedParagraphs.nth(0)).toContainText("Second paragraph");
    await expect(reorderedParagraphs.nth(2)).toContainText("First paragraph");
  });

  test("should move block up with Alt+ArrowUp", async ({ page }) => {
    const secondP = page.locator('[data-testid="block-editor"] p').nth(1);
    await secondP.click();

    await page.keyboard.press("Alt+ArrowUp");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("Second paragraph");
    await expect(paragraphs.nth(1)).toContainText("First paragraph");
  });

  test("should move block down with Alt+ArrowDown", async ({ page }) => {
    const firstP = page.locator('[data-testid="block-editor"] p').first();
    await firstP.click();

    await page.keyboard.press("Alt+ArrowDown");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("Second paragraph");
    await expect(paragraphs.nth(1)).toContainText("First paragraph");
  });

  test("should not move first block up past the beginning", async ({
    page,
  }) => {
    const firstP = page.locator('[data-testid="block-editor"] p').first();
    await firstP.click();

    await page.keyboard.press("Alt+ArrowUp");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("First paragraph");
  });

  test("should not move last block down past the end", async ({ page }) => {
    const lastP = page.locator('[data-testid="block-editor"] p').nth(2);
    await lastP.click();

    await page.keyboard.press("Alt+ArrowDown");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(2)).toContainText("Third paragraph");
  });

  test("should persist reordered content after auto-save", async ({
    page,
  }) => {
    const secondP = page.locator('[data-testid="block-editor"] p').nth(1);
    await secondP.click();
    await page.keyboard.press("Alt+ArrowUp");

    const saveStatus = page.locator('[data-testid="save-status"]');
    await expect(saveStatus).toContainText("Saved", { timeout: 5000 });

    await page.reload();
    await page.waitForSelector('[data-testid="block-editor"]');

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("Second paragraph");
    await expect(paragraphs.nth(1)).toContainText("First paragraph");
  });
});
