import * as crypto from "crypto";
import { TokenBucketRateLimiter } from "./rateLimiter";
import type {
  PageResult,
  PageSearchResult,
  UpsertResult,
  WriterConfig,
} from "./types";

class SkbAgentApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "SkbAgentApiError";
    this.statusCode = statusCode;
  }
}

export class SkbAgentApiWriter {
  private readonly config: Required<WriterConfig>;
  private readonly rateLimiter: TokenBucketRateLimiter;

  constructor(config: WriterConfig) {
    this.config = {
      apiUrl: config.apiUrl.replace(/\/$/, ""),
      apiKey: config.apiKey,
      rateLimit: config.rateLimit ?? 10,
      maxRetries: config.maxRetries ?? 3,
    };
    this.rateLimiter = new TokenBucketRateLimiter(
      this.config.rateLimit,
      this.config.rateLimit
    );
  }

  async createPage(
    markdown: string,
    options: {
      parentId?: string;
      title?: string;
      icon?: string;
      oneLiner?: string;
    } = {}
  ): Promise<PageResult> {
    await this.rateLimiter.acquire();

    const title =
      options.title ?? this.extractTitleFromMarkdown(markdown) ?? "Untitled";

    const body: Record<string, string> = { title, markdown };
    if (options.parentId) body.parent_id = options.parentId;
    if (options.icon) body.icon = options.icon;

    const response = await this.fetchWithRetry(
      `${this.config.apiUrl}/api/agent/pages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const json = (await response.json()) as {
      data: { id: string; title: string; created_at: string };
    };
    return {
      id: json.data.id,
      title: json.data.title,
      createdAt: json.data.created_at,
    };
  }

  async updatePage(
    pageId: string,
    markdown: string,
    options: { title?: string } = {}
  ): Promise<PageResult> {
    await this.rateLimiter.acquire();

    const body: Record<string, string> = { markdown };
    if (options.title) body.title = options.title;

    const response = await this.fetchWithRetry(
      `${this.config.apiUrl}/api/agent/pages/${encodeURIComponent(pageId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const json = (await response.json()) as {
      data: { id: string; updated_at: string };
    };
    return {
      id: json.data.id,
      title: options.title ?? "",
      updatedAt: json.data.updated_at,
    };
  }

  async searchPages(query: string): Promise<PageSearchResult[]> {
    await this.rateLimiter.acquire();

    const params = new URLSearchParams({ search: query });
    const response = await this.fetchWithRetry(
      `${this.config.apiUrl}/api/agent/pages?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "application/json",
        },
      }
    );

    const json = (await response.json()) as { data: PageSearchResult[] };
    return json.data;
  }

  async getPage(
    pageId: string
  ): Promise<(PageSearchResult & { markdown: string }) | null> {
    await this.rateLimiter.acquire();

    try {
      const response = await this.fetchWithRetry(
        `${this.config.apiUrl}/api/agent/pages/${encodeURIComponent(pageId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: "application/json",
          },
        }
      );

      const json = (await response.json()) as {
        data: PageSearchResult & { markdown: string };
      };
      return json.data;
    } catch (error) {
      if (
        error instanceof SkbAgentApiError &&
        error.statusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async upsertPage(
    markdown: string,
    matchTag: string,
    options: {
      parentId?: string;
      title?: string;
      icon?: string;
      oneLiner?: string;
    } = {}
  ): Promise<UpsertResult> {
    const contentHash = this.computeHash(markdown);

    const existing = await this.searchPages(`tag:${matchTag}`);

    if (existing.length > 0) {
      const page = existing[0];

      const currentPage = await this.getPage(page.id);
      if (currentPage) {
        const existingHash = this.computeHash(currentPage.markdown);
        if (existingHash === contentHash) {
          return {
            action: "skipped",
            pageId: page.id,
            title: page.title,
            contentHash,
          };
        }
      }

      const result = await this.updatePage(page.id, markdown, {
        title: options.title,
      });
      return {
        action: "updated",
        pageId: result.id,
        title: result.title || page.title,
        contentHash,
      };
    }

    const result = await this.createPage(markdown, options);
    return {
      action: "created",
      pageId: result.id,
      title: result.title,
      contentHash,
    };
  }

  computeHash(content: string): string {
    const stripped = content.replace(/^(created|updated):.*$/gm, "");
    return crypto.createHash("md5").update(stripped).digest("hex");
  }

  private extractTitleFromMarkdown(markdown: string): string | null {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.ok) return response;

        if (response.status === 429) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
          console.warn(
            `Rate limited (429). Waiting ${delay}ms before retry...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (response.status >= 500) {
          if (attempt < this.config.maxRetries) {
            console.warn(
              `Server error (${response.status}). Retry ${attempt + 1}/${this.config.maxRetries}...`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw new SkbAgentApiError(
            response.status,
            `Server error after ${this.config.maxRetries} retries`
          );
        }

        if (response.status === 404) {
          console.warn(`Not found (404): ${url}. Skipping.`);
          throw new SkbAgentApiError(404, `Not found: ${url}`);
        }

        if (response.status === 400) {
          const body = await response.text();
          throw new SkbAgentApiError(400, `Bad request (400): ${body}`);
        }

        throw new SkbAgentApiError(
          response.status,
          `Unexpected status ${response.status}`
        );
      } catch (error) {
        lastError = error as Error;
        if (error instanceof SkbAgentApiError) {
          if (error.statusCode === 404 || error.statusCode === 400) {
            throw error;
          }
        }
        if (attempt >= this.config.maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }
}

export function createWriter(): SkbAgentApiWriter {
  const apiUrl = process.env.SKB_AGENT_API_URL;
  const apiKey = process.env.SKB_AGENT_API_KEY;

  if (!apiUrl)
    throw new Error("SKB_AGENT_API_URL environment variable is required");
  if (!apiKey)
    throw new Error("SKB_AGENT_API_KEY environment variable is required");

  return new SkbAgentApiWriter({ apiUrl, apiKey });
}

export { SkbAgentApiError };
