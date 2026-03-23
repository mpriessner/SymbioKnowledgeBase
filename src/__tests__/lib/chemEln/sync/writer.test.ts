import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SkbAgentApiWriter,
  SkbAgentApiError,
  createWriter,
} from "@/lib/chemEln/sync/writer";

function mockFetchResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function mockTextResponse(body: string, status = 200) {
  return new Response(body, { status });
}

describe("SkbAgentApiWriter", () => {
  let writer: SkbAgentApiWriter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writer = new SkbAgentApiWriter({
      apiUrl: "http://localhost:3000",
      apiKey: "test-api-key",
      rateLimit: 1000, // high limit for tests
      maxRetries: 2,
    });

    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication", () => {
    it("should send Authorization Bearer header with API key", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: { id: "page-1", title: "Test", created_at: "2026-03-21" },
        })
      );

      await writer.createPage("# Test\n\nContent");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer test-api-key");
    });
  });

  describe("createPage", () => {
    it("should create a page and return PageResult", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "page-1",
            title: "Test Page",
            created_at: "2026-03-21T00:00:00Z",
          },
        })
      );

      const result = await writer.createPage("# Test Page\n\nSome content", {
        parentId: "parent-1",
        title: "Test Page",
      });

      expect(result.id).toBe("page-1");
      expect(result.title).toBe("Test Page");
      expect(result.createdAt).toBe("2026-03-21T00:00:00Z");

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/agent/pages");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.title).toBe("Test Page");
      expect(body.markdown).toBe("# Test Page\n\nSome content");
      expect(body.parent_id).toBe("parent-1");
    });

    it("should extract title from markdown if not provided", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "page-1",
            title: "My Title",
            created_at: "2026-03-21T00:00:00Z",
          },
        })
      );

      await writer.createPage("# My Title\n\nContent");

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.title).toBe("My Title");
    });

    it("should use 'Untitled' if no title is extractable", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "page-1",
            title: "Untitled",
            created_at: "2026-03-21T00:00:00Z",
          },
        })
      );

      await writer.createPage("No heading here, just text");

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.title).toBe("Untitled");
    });
  });

  describe("updatePage", () => {
    it("should update a page and return PageResult", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "page-1",
            updated_at: "2026-03-21T12:00:00Z",
          },
        })
      );

      const result = await writer.updatePage(
        "page-1",
        "# Updated\n\nNew content"
      );

      expect(result.id).toBe("page-1");
      expect(result.updatedAt).toBe("2026-03-21T12:00:00Z");

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/agent/pages/page-1");
      expect(options.method).toBe("PUT");

      const body = JSON.parse(options.body);
      expect(body.markdown).toBe("# Updated\n\nNew content");
    });
  });

  describe("searchPages", () => {
    it("should search pages by query and return results", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: [
            {
              id: "page-1",
              title: "Experiment 001",
              icon: null,
              parent_id: null,
              created_at: "2026-03-21T00:00:00Z",
              updated_at: "2026-03-21T00:00:00Z",
            },
          ],
        })
      );

      const results = await writer.searchPages("tag:eln:EXP-001");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("page-1");
      expect(results[0].title).toBe("Experiment 001");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("search=tag%3Aeln%3AEXP-001");
    });
  });

  describe("getPage", () => {
    it("should return page data when found", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "page-1",
            title: "Test",
            icon: null,
            parent_id: null,
            created_at: "2026-03-21T00:00:00Z",
            updated_at: "2026-03-21T00:00:00Z",
            markdown: "# Test content",
          },
        })
      );

      const result = await writer.getPage("page-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("page-1");
      expect(result!.markdown).toBe("# Test content");
    });

    it("should return null when page is not found (404)", async () => {
      fetchMock.mockResolvedValueOnce(mockTextResponse("Not found", 404));

      const result = await writer.getPage("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("upsertPage", () => {
    it("should create a new page when no match is found", async () => {
      // searchPages returns empty
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ data: [] })
      );
      // createPage
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "new-page",
            title: "Experiment 001",
            created_at: "2026-03-21T00:00:00Z",
          },
        })
      );

      const result = await writer.upsertPage(
        "# Experiment 001\n\nResults here",
        "eln:EXP-001",
        { title: "Experiment 001" }
      );

      expect(result.action).toBe("created");
      expect(result.pageId).toBe("new-page");
    });

    it("should update an existing page when match is found and content differs", async () => {
      // searchPages returns a match
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: [
            {
              id: "existing-page",
              title: "Experiment 001",
              icon: null,
              parent_id: null,
              created_at: "2026-03-21T00:00:00Z",
              updated_at: "2026-03-21T00:00:00Z",
            },
          ],
        })
      );
      // getPage returns existing content (different)
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "existing-page",
            title: "Experiment 001",
            icon: null,
            parent_id: null,
            created_at: "2026-03-21T00:00:00Z",
            updated_at: "2026-03-21T00:00:00Z",
            markdown: "# Experiment 001\n\nOld content",
          },
        })
      );
      // updatePage
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "existing-page",
            updated_at: "2026-03-21T12:00:00Z",
          },
        })
      );

      const result = await writer.upsertPage(
        "# Experiment 001\n\nNew content",
        "eln:EXP-001"
      );

      expect(result.action).toBe("updated");
      expect(result.pageId).toBe("existing-page");
    });

    it("should skip update when content is unchanged", async () => {
      const markdown = "# Experiment 001\n\nSame content";

      // searchPages returns a match
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: [
            {
              id: "existing-page",
              title: "Experiment 001",
              icon: null,
              parent_id: null,
              created_at: "2026-03-21T00:00:00Z",
              updated_at: "2026-03-21T00:00:00Z",
            },
          ],
        })
      );
      // getPage returns same content
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: {
            id: "existing-page",
            title: "Experiment 001",
            icon: null,
            parent_id: null,
            created_at: "2026-03-21T00:00:00Z",
            updated_at: "2026-03-21T00:00:00Z",
            markdown,
          },
        })
      );

      const result = await writer.upsertPage(markdown, "eln:EXP-001");

      expect(result.action).toBe("skipped");
      expect(result.pageId).toBe("existing-page");
      // Should not have called updatePage (only 2 fetch calls: search + getPage)
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("rate limiting", () => {
    it("should throttle requests when rate limit is exceeded", async () => {
      const slowWriter = new SkbAgentApiWriter({
        apiUrl: "http://localhost:3000",
        apiKey: "test-key",
        rateLimit: 2, // only 2 per second
        maxRetries: 0,
      });

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          mockFetchResponse({
            data: {
              id: "p",
              title: "T",
              created_at: "2026-01-01",
            },
          })
        )
      );

      const start = Date.now();

      // Fire 3 requests — the 3rd should be delayed
      await Promise.all([
        slowWriter.createPage("# A", { title: "A" }),
        slowWriter.createPage("# B", { title: "B" }),
        slowWriter.createPage("# C", { title: "C" }),
      ]);

      const elapsed = Date.now() - start;
      // With bucket size 2 and rate 2/sec, the 3rd request should wait ~500ms
      expect(elapsed).toBeGreaterThanOrEqual(200); // conservative threshold
    });
  });

  describe("retry logic", () => {
    it("should retry on 500 errors and succeed", async () => {
      let attempts = 0;
      fetchMock.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return mockTextResponse("Server Error", 500);
        }
        return mockFetchResponse({
          data: {
            id: "page-1",
            title: "Test",
            created_at: "2026-03-21",
          },
        });
      });

      const result = await writer.createPage("# Test", { title: "Test" });
      expect(result.id).toBe("page-1");
      expect(attempts).toBe(3);
    });

    it("should fail after max retries on 500 errors", async () => {
      fetchMock.mockImplementation(async () =>
        mockTextResponse("Server Error", 500)
      );

      await expect(
        writer.createPage("# Test", { title: "Test" })
      ).rejects.toThrow();
    });

    it("should backoff exponentially on 429 errors", async () => {
      const delays: number[] = [];
      const origSetTimeout = globalThis.setTimeout;
      vi.spyOn(globalThis, "setTimeout").mockImplementation(
        ((fn: () => void, delay?: number) => {
          if (delay && delay >= 1000) {
            delays.push(delay);
          }
          return origSetTimeout(fn, 0);
        }) as typeof setTimeout
      );

      let attempts = 0;
      fetchMock.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return mockTextResponse("Rate limited", 429);
        }
        return mockFetchResponse({
          data: {
            id: "page-1",
            title: "Test",
            created_at: "2026-03-21",
          },
        });
      });

      await writer.createPage("# Test", { title: "Test" });
      expect(delays).toContain(2000);
      expect(delays).toContain(4000);
    });

    it("should skip with warning on 404 errors (getPage returns null)", async () => {
      fetchMock.mockResolvedValueOnce(mockTextResponse("Not found", 404));

      const result = await writer.getPage("nonexistent");
      expect(result).toBeNull();
    });

    it("should fail immediately on 400 errors", async () => {
      fetchMock.mockResolvedValueOnce(
        mockTextResponse('{"error":{"code":"VALIDATION_ERROR","message":"Invalid"}}', 400)
      );

      await expect(
        writer.createPage("bad", { title: "Bad" })
      ).rejects.toThrow("Bad request (400)");

      // Should not retry
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("content hashing", () => {
    it("should produce stable hashes ignoring timestamps", () => {
      const md1 =
        "---\ntitle: Test\ncreated: 2026-03-01\n---\n# Content";
      const md2 =
        "---\ntitle: Test\ncreated: 2026-03-21\n---\n# Content";

      const hash1 = writer.computeHash(md1);
      const hash2 = writer.computeHash(md2);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different content", () => {
      const md1 = "# Page A\n\nContent A";
      const md2 = "# Page B\n\nContent B";

      expect(writer.computeHash(md1)).not.toBe(writer.computeHash(md2));
    });
  });

  describe("createWriter factory", () => {
    it("should throw if SKB_AGENT_API_URL is not set", () => {
      delete process.env.SKB_AGENT_API_URL;
      delete process.env.SKB_AGENT_API_KEY;

      expect(() => createWriter()).toThrow(
        "SKB_AGENT_API_URL environment variable is required"
      );
    });

    it("should throw if SKB_AGENT_API_KEY is not set", () => {
      process.env.SKB_AGENT_API_URL = "http://localhost:3000";
      delete process.env.SKB_AGENT_API_KEY;

      expect(() => createWriter()).toThrow(
        "SKB_AGENT_API_KEY environment variable is required"
      );
    });

    it("should create writer when env vars are set", () => {
      process.env.SKB_AGENT_API_URL = "http://localhost:3000";
      process.env.SKB_AGENT_API_KEY = "test-key";

      const w = createWriter();
      expect(w).toBeInstanceOf(SkbAgentApiWriter);

      delete process.env.SKB_AGENT_API_URL;
      delete process.env.SKB_AGENT_API_KEY;
    });
  });
});
