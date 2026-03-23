import { type Page, type APIRequestContext, expect } from "@playwright/test";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * Wait for the app to be ready after navigation.
 */
export async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

/**
 * Navigate to a path and wait for load.
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await waitForApp(page);
}

/**
 * Wait for the TipTap editor to be ready.
 */
export async function waitForEditor(page: Page) {
  await page.waitForSelector(".tiptap, .ProseMirror, [data-testid='block-editor']", {
    timeout: 10_000,
  });
}

/**
 * Create a page via the API and return its ID and title.
 */
export async function createPageViaAPI(
  request: APIRequestContext,
  title: string = "Test Page"
): Promise<{ id: string; title: string }> {
  const response = await request.post(`${BASE_URL}/api/pages`, {
    data: { title },
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json();
  return { id: body.data?.id ?? body.id, title: body.data?.title ?? body.title ?? title };
}

/**
 * Delete a page via the API.
 */
export async function deletePageViaAPI(
  request: APIRequestContext,
  pageId: string
): Promise<void> {
  await request.delete(`${BASE_URL}/api/pages/${pageId}`);
}

/**
 * Get the current page URL path.
 */
export function getPath(page: Page): string {
  return new URL(page.url()).pathname;
}
