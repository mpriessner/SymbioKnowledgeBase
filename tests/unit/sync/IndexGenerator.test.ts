import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockRename = vi.fn();

vi.mock("fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    rename: (...args: unknown[]) => mockRename(...args),
  },
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  rename: (...args: unknown[]) => mockRename(...args),
}));

vi.mock("@/lib/sync/config", () => ({
  MIRROR_ROOT: "/tmp/test-mirror",
  META_FILENAME: ".skb-meta.json",
  INDEX_FILENAME: "_index.md",
  DATABASES_DIR: "Databases",
}));

vi.mock("@/lib/sync/SyncLock", () => ({
  syncLock: {
    acquire: vi.fn(() => true),
    release: vi.fn(),
    isLocked: vi.fn(() => false),
  },
}));

import { generateIndex, writeIndex, debouncedWriteIndex } from "../../../src/lib/sync/IndexGenerator";

const TENANT_ID = "tenant-001";
const TENANT_ROOT = "/tmp/test-mirror/tenant-001";

function makeMeta(pages: Record<string, any> = {}, databases: Record<string, any> = {}) {
  return JSON.stringify({
    version: 2,
    tenantId: TENANT_ID,
    lastFullSync: "2026-03-23T14:30:00.000Z",
    pages,
    databases,
  });
}

function makePageFile(opts: { icon?: string; title?: string } = {}) {
  const lines = ["---"];
  if (opts.icon) lines.push(`icon: ${opts.icon}`);
  if (opts.title) lines.push(`title: ${opts.title}`);
  lines.push("---", "", "# Content");
  return lines.join("\n");
}

function makeDbFile(opts: { icon?: string; columns?: number } = {}) {
  const lines = ["---"];
  if (opts.icon) lines.push(`icon: ${opts.icon}`);
  lines.push("columns:");
  const colCount = opts.columns ?? 2;
  for (let i = 0; i < colCount; i++) {
    lines.push(`  - id: col-${i}`, `    name: Column ${i}`, `    type: TEXT`);
  }
  lines.push("---", "", "# DB");
  return lines.join("\n");
}

describe("IndexGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateIndex", () => {
    it("generates index with empty metadata", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await generateIndex(TENANT_ID);

      expect(result).toContain("generated: true");
      expect(result).toContain("type: index");
      expect(result).toContain("# Knowledge Base Index");
      expect(result).toContain("**Pages:** 0");
      expect(result).toContain("**Databases:** 0");
      expect(result).not.toContain("## Pages");
      expect(result).not.toContain("## Databases");
    });

    it("generates index with pages as hierarchical tree", async () => {
      const meta = makeMeta({
        "page-1": {
          id: "page-1",
          filePath: "System Architecture/_index.md",
          contentHash: "abc",
          lastSynced: "2026-03-23T14:00:00Z",
        },
        "page-2": {
          id: "page-2",
          filePath: "System Architecture/Data Models.md",
          contentHash: "def",
          lastSynced: "2026-03-23T14:00:00Z",
        },
        "page-3": {
          id: "page-3",
          filePath: "Welcome.md",
          contentHash: "ghi",
          lastSynced: "2026-03-23T14:00:00Z",
        },
      });

      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith(".skb-meta.json")) return meta;
        if (filePath.includes("System Architecture/_index.md")) {
          return makePageFile({ icon: "\uD83C\uDFD7\uFE0F", title: "System Architecture" });
        }
        if (filePath.includes("Data Models.md")) {
          return makePageFile({ title: "Data Models" });
        }
        if (filePath.includes("Welcome.md")) {
          return makePageFile({ title: "Welcome" });
        }
        throw new Error("ENOENT");
      });

      const result = await generateIndex(TENANT_ID);

      expect(result).toContain("**Pages:** 3");
      expect(result).toContain("## Pages");
      expect(result).toContain("- \uD83C\uDFD7\uFE0F [System Architecture](System Architecture/_index.md)");
      expect(result).toContain("  - [Data Models](System Architecture/Data Models.md)");
      expect(result).toContain("- [Welcome](Welcome.md)");
    });

    it("generates index with databases including row and column counts", async () => {
      const meta = makeMeta(
        {},
        {
          "db-1": {
            id: "db-1",
            filePath: "Databases/Tasks.md",
            contentHash: "abc",
            lastSynced: "2026-03-23T14:00:00Z",
            rowCount: 15,
          },
          "db-2": {
            id: "db-2",
            filePath: "Databases/Contacts.md",
            contentHash: "def",
            lastSynced: "2026-03-23T14:00:00Z",
            rowCount: 42,
          },
        }
      );

      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith(".skb-meta.json")) return meta;
        if (filePath.includes("Tasks.md")) {
          return makeDbFile({ icon: "\u2705", columns: 6 });
        }
        if (filePath.includes("Contacts.md")) {
          return makeDbFile({ icon: "\uD83D\uDC65", columns: 8 });
        }
        throw new Error("ENOENT");
      });

      const result = await generateIndex(TENANT_ID);

      expect(result).toContain("**Databases:** 2");
      expect(result).toContain("## Databases");
      expect(result).toContain("\uD83D\uDC65 [Contacts](Databases/Contacts.md) — 42 rows, 8 columns");
      expect(result).toContain("\u2705 [Tasks](Databases/Tasks.md) — 15 rows, 6 columns");
    });

    it("includes frontmatter with generated: true and updated timestamp", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await generateIndex(TENANT_ID);

      expect(result).toMatch(/^---\n/);
      expect(result).toContain("generated: true");
      expect(result).toContain("type: index");
      expect(result).toMatch(/updated: \d{4}-\d{2}-\d{2}T/);
    });

    it("includes summary with last sync time from metadata", async () => {
      const meta = makeMeta();
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith(".skb-meta.json")) return meta;
        throw new Error("ENOENT");
      });

      const result = await generateIndex(TENANT_ID);

      expect(result).toContain("**Last sync:** 2026-03-23T14:30:00.000Z");
    });

    it("renders deeply nested page tree", async () => {
      const meta = makeMeta({
        "page-1": {
          id: "page-1",
          filePath: "Projects/_index.md",
          contentHash: "a",
          lastSynced: "2026-03-23T14:00:00Z",
        },
        "page-2": {
          id: "page-2",
          filePath: "Projects/Alpha/_index.md",
          contentHash: "b",
          lastSynced: "2026-03-23T14:00:00Z",
        },
        "page-3": {
          id: "page-3",
          filePath: "Projects/Alpha/Design.md",
          contentHash: "c",
          lastSynced: "2026-03-23T14:00:00Z",
        },
      });

      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.endsWith(".skb-meta.json")) return meta;
        return makePageFile({});
      });

      const result = await generateIndex(TENANT_ID);

      expect(result).toContain("- [Projects](Projects/_index.md)");
      expect(result).toContain("  - [Alpha](Projects/Alpha/_index.md)");
      expect(result).toContain("    - [Design](Projects/Alpha/Design.md)");
    });
  });

  describe("writeIndex", () => {
    it("writes _index.md with atomic write pattern", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      await writeIndex(TENANT_ID);

      // Should write to a temp file
      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[0]).toMatch(/\.tmp\./);
      expect(typeof writeCall[1]).toBe("string");
      expect(writeCall[1] as string).toContain("generated: true");

      // Should rename temp to final path
      const renameCall = mockRename.mock.calls[0];
      expect(renameCall[1]).toBe(path.join(TENANT_ROOT, "_index.md"));
    });
  });

  describe("debouncedWriteIndex", () => {
    it("debounces multiple rapid calls", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      debouncedWriteIndex(TENANT_ID);
      debouncedWriteIndex(TENANT_ID);
      debouncedWriteIndex(TENANT_ID);

      // No writes should have happened yet
      expect(mockWriteFile).not.toHaveBeenCalled();

      // Advance past the debounce window
      await vi.advanceTimersByTimeAsync(1100);

      // Should have written exactly once
      expect(mockRename).toHaveBeenCalledTimes(1);
    });
  });
});
