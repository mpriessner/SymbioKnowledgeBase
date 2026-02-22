/**
 * SymbioKnowledgeBase Agent API — TypeScript Client
 *
 * A production-ready client for the SymbioKnowledgeBase Agent API.
 * Provides typed access to pages, search, and knowledge graph endpoints
 * with built-in rate limit handling and retry logic.
 *
 * @example
 * ```ts
 * import { SymbioKB } from "./symbio-kb-client.js";
 *
 * const kb = new SymbioKB({
 *   baseUrl: "https://kb.example.com",
 *   apiKey: "skb_live_...",
 * });
 *
 * const results = await kb.search("deployment guide");
 * const page = await kb.readPage(results.results[0].page_id);
 * ```
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A knowledge base page. */
export interface Page {
  id: string;
  title: string;
  icon?: string | null;
  parent_id?: string | null;
  markdown?: string;
  created_at?: string;
  updated_at?: string;
}

/** A single full-text search result. */
export interface SearchResult {
  page_id: string;
  title: string;
  snippet: string;
  score: number;
  icon?: string | null;
}

/** Standard API response envelope for single items. */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    [key: string]: unknown;
  };
}

/** Standard API response envelope for lists with pagination. */
export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    timestamp: string;
  };
}

/** Standard API error envelope. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
  meta: {
    timestamp: string;
  };
}

/** Options for constructing a SymbioKB client. */
export interface SymbioKBOptions {
  /** Base URL of the SymbioKnowledgeBase instance. */
  baseUrl: string;
  /** Bearer token: API key (skb_live_*) or Supabase JWT. */
  apiKey: string;
  /** HTTP request timeout in milliseconds. Default: 30000. */
  timeout?: number;
  /** Maximum automatic retries on 429 responses. Default: 3. */
  maxRetries?: number;
}

/** Paginated page list result. */
export interface PageListResult {
  pages: Page[];
  total: number;
  limit: number;
  offset: number;
}

/** Paginated search result list. */
export interface SearchResults {
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Base error class for all SymbioKB client errors. */
export class SymbioKBError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "SymbioKBError";
    this.code = code;
    this.status = status;
  }
}

/** Raised when the API key is missing, invalid, or revoked (HTTP 401). */
export class AuthenticationError extends SymbioKBError {
  constructor(message: string, code?: string) {
    super(message, code, 401);
    this.name = "AuthenticationError";
  }
}

/** Raised when the API key lacks the required scope (HTTP 403). */
export class ForbiddenError extends SymbioKBError {
  constructor(message: string, code?: string) {
    super(message, code, 403);
    this.name = "ForbiddenError";
  }
}

/** Raised when the requested resource does not exist (HTTP 404). */
export class NotFoundError extends SymbioKBError {
  constructor(message: string, code?: string) {
    super(message, code, 404);
    this.name = "NotFoundError";
  }
}

/** Raised when request parameters fail server-side validation (HTTP 400). */
export class ValidationError extends SymbioKBError {
  constructor(message: string, code?: string) {
    super(message, code, 400);
    this.name = "ValidationError";
  }
}

/** Raised when rate limiting is exceeded and all retries are exhausted. */
export class RateLimitError extends SymbioKBError {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number, code?: string) {
    super(message, code, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Raised for unexpected server-side errors (HTTP 5xx). */
export class ServerError extends SymbioKBError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status ?? 500);
    this.name = "ServerError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Client for the SymbioKnowledgeBase Agent API.
 *
 * All methods are async and return typed results. Rate limiting (HTTP 429)
 * is handled automatically with exponential back-off guided by the
 * `Retry-After` header.
 */
export class SymbioKB {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: SymbioKBOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private url(path: string): string {
    return `${this.baseUrl}/api/agent${path}`;
  }

  /** Sleep for the given number of milliseconds. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute an HTTP request with automatic rate-limit retry logic.
   */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number>;
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const url = new URL(this.url(path));

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new SymbioKBError(`Request timed out after ${this.timeout}ms`);
        }
        throw new SymbioKBError(
          `HTTP request failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        clearTimeout(timeoutId);
      }

      // --- Rate limit handling (429) ---
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5", 10);
        if (attempt < this.maxRetries) {
          await this.sleep(retryAfter * 1000);
          continue;
        }
        throw new RateLimitError(
          "Rate limit exceeded after all retries",
          retryAfter,
          "RATE_LIMIT_EXCEEDED",
        );
      }

      // --- Parse response body ---
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ServerError(
          `Non-JSON response (HTTP ${response.status})`,
          undefined,
          response.status,
        );
      }

      // --- Success ---
      if (response.ok) {
        return body as T;
      }

      // --- Error mapping ---
      const errorBody = body as ApiErrorBody;
      const code = errorBody?.error?.code ?? "UNKNOWN";
      const message = errorBody?.error?.message ?? response.statusText;

      switch (response.status) {
        case 400:
          throw new ValidationError(message, code);
        case 401:
          throw new AuthenticationError(message, code);
        case 403:
          throw new ForbiddenError(message, code);
        case 404:
          throw new NotFoundError(message, code);
        default:
          if (response.status >= 500) {
            throw new ServerError(message, code, response.status);
          }
          throw new SymbioKBError(
            `Unexpected HTTP ${response.status}: ${message}`,
            code,
            response.status,
          );
      }
    }

    // Should never reach here, but TypeScript requires a return.
    throw new SymbioKBError("Request failed unexpectedly");
  }

  // -----------------------------------------------------------------------
  // Public API — Search
  // -----------------------------------------------------------------------

  /**
   * Full-text search across all pages in the knowledge base.
   *
   * Uses PostgreSQL `websearch_to_tsquery` on the server side, so standard
   * web-search syntax is supported (e.g. `"exact phrase"`, `term1 OR term2`).
   *
   * @param query  The search query string (1-500 characters).
   * @param limit  Maximum number of results (1-100, default 20).
   * @param offset Number of results to skip for pagination (default 0).
   */
  async search(
    query: string,
    options?: { limit?: number; offset?: number },
  ): Promise<SearchResults> {
    const body = await this.request<ApiListResponse<SearchResult>>(
      "GET",
      "/search",
      {
        params: {
          q: query,
          limit: options?.limit ?? 20,
          offset: options?.offset ?? 0,
        },
      },
    );

    return {
      results: body.data,
      total: body.meta.total,
      limit: body.meta.limit,
      offset: body.meta.offset,
    };
  }

  // -----------------------------------------------------------------------
  // Public API — Pages
  // -----------------------------------------------------------------------

  /**
   * Read a single page including its markdown content.
   *
   * @param pageId UUID of the page to read.
   * @throws NotFoundError if the page does not exist.
   */
  async readPage(pageId: string): Promise<Page> {
    const body = await this.request<ApiResponse<Page>>("GET", `/pages/${pageId}`);
    return body.data;
  }

  /**
   * Create a new page in the knowledge base.
   *
   * @param title    Page title (1-255 characters).
   * @param options  Optional markdown content, parent_id, and icon.
   * @throws ValidationError if the title is empty or too long.
   * @throws NotFoundError if the specified parent_id does not exist.
   */
  async createPage(
    title: string,
    options?: {
      markdown?: string;
      parent_id?: string;
      icon?: string;
    },
  ): Promise<Page> {
    const payload: Record<string, unknown> = { title };
    if (options?.markdown !== undefined) payload.markdown = options.markdown;
    if (options?.parent_id !== undefined) payload.parent_id = options.parent_id;
    if (options?.icon !== undefined) payload.icon = options.icon;

    const body = await this.request<ApiResponse<Page>>("POST", "/pages", {
      body: payload,
    });
    return body.data;
  }

  /**
   * Replace the markdown content of an existing page.
   *
   * @param pageId   UUID of the page to update.
   * @param markdown The new markdown content (replaces existing content).
   * @throws NotFoundError if the page does not exist.
   */
  async updatePage(pageId: string, markdown: string): Promise<Page> {
    const body = await this.request<ApiResponse<Page>>("PUT", `/pages/${pageId}`, {
      body: { markdown },
    });
    return body.data;
  }

  /**
   * List pages with optional filtering and pagination.
   *
   * @param options  Pagination, parent filtering, and title search options.
   */
  async listPages(options?: {
    limit?: number;
    offset?: number;
    parent_id?: string;
    search?: string;
  }): Promise<PageListResult> {
    const params: Record<string, string | number> = {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    };
    if (options?.parent_id) params.parent_id = options.parent_id;
    if (options?.search) params.search = options.search;

    const body = await this.request<ApiListResponse<Page>>("GET", "/pages", {
      params,
    });

    return {
      pages: body.data,
      total: body.meta.total,
      limit: body.meta.limit,
      offset: body.meta.offset,
    };
  }
}

// ---------------------------------------------------------------------------
// Example usage
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const baseUrl = process.env.SYMBIO_KB_URL ?? "http://localhost:3000";
  const apiKey = process.env.SYMBIO_KB_API_KEY ?? "";

  if (!apiKey) {
    console.error("Set SYMBIO_KB_API_KEY environment variable to run this example.");
    process.exit(1);
  }

  const kb = new SymbioKB({ baseUrl, apiKey });

  // --- List pages ---
  console.log("=== Listing pages ===");
  const pageList = await kb.listPages({ limit: 5 });
  console.log(`Total pages: ${pageList.total}`);
  for (const page of pageList.pages) {
    console.log(`  [${page.id.slice(0, 8)}...] ${page.title}`);
  }

  // --- Create a page ---
  console.log("\n=== Creating a page ===");
  const newPage = await kb.createPage("Agent API Test Page", {
    markdown:
      "# Hello from the TypeScript client\n\nThis page was created via the Agent API.",
    icon: "📘",
  });
  console.log(`Created page: ${newPage.id} — ${newPage.title}`);

  // --- Read the page back ---
  console.log("\n=== Reading page ===");
  const page = await kb.readPage(newPage.id);
  console.log(`Title: ${page.title}`);
  console.log(`Markdown:\n${page.markdown}`);

  // --- Update the page ---
  console.log("\n=== Updating page ===");
  const updated = await kb.updatePage(
    newPage.id,
    "# Updated content\n\nThis content was updated via the Agent API.\n\nSee also: [[Other Page]]",
  );
  console.log(`Updated at: ${updated.updated_at}`);

  // --- Search ---
  console.log("\n=== Searching ===");
  try {
    const results = await kb.search("Agent API");
    console.log(`Found ${results.total} results`);
    for (const r of results.results) {
      console.log(`  [${r.page_id.slice(0, 8)}...] ${r.title} (score: ${r.score.toFixed(3)})`);
      console.log(`    ${r.snippet}`);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      console.error(`Search validation error: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
