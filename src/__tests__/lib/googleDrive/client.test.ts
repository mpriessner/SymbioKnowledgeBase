import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  searchFiles,
  getFileMetadata,
  downloadFile,
  createFile,
  buildAuthUrl,
  DRIVE_SCOPES,
  DriveRateLimitError,
  DriveApiError,
  DriveAuthError,
} from "@/lib/integrations/googleDrive/client";

const CLIENT_TS_PATH = path.resolve(
  __dirname,
  "../../../lib/integrations/googleDrive/client.ts"
);

describe("Google Drive client — no-delete/no-modify boundary (a71-12 AC5)", () => {
  it("never references a Drive-mutating method on an existing file anywhere in the source", () => {
    const source = fs.readFileSync(CLIENT_TS_PATH, "utf-8");

    // Static-analysis regression guard per the story's verification plan:
    // fail if a delete/trash/update-in-place call is ever introduced.
    expect(source).not.toMatch(/\.files\.delete\(/);
    expect(source).not.toMatch(/\.files\.update\(/);
    expect(source).not.toMatch(/\.files\.emptyTrash\(/);
    // No DELETE or PATCH/PUT HTTP verb is used anywhere — the connector only
    // ever needs GET (search/get/download) and POST (token exchange/revoke,
    // and files.create, which allocates a new file id and cannot overwrite).
    expect(source).not.toMatch(/method:\s*["']DELETE["']/);
    expect(source).not.toMatch(/method:\s*["']PATCH["']/);
    expect(source).not.toMatch(/method:\s*["']PUT["']/);
  });

  it("does not export any delete/update/trash function", async () => {
    const client = await import("@/lib/integrations/googleDrive/client");
    const exportNames = Object.keys(client);
    for (const name of exportNames) {
      expect(name.toLowerCase()).not.toMatch(/delete|trash/);
      // "update" would only be acceptable as part of an unrelated word; guard
      // against an actual updateFile/updateExisting-style export.
      expect(name).not.toMatch(/^update/i);
    }
  });

  it("requests exactly the two approved scopes in the consent URL, never a broader one", () => {
    const url = buildAuthUrl(
      { clientId: "cid", clientSecret: "secret", redirectUri: "https://kb.example.com/cb" },
      "state-123"
    );
    const parsed = new URL(url);
    const scopeParam = parsed.searchParams.get("scope");
    expect(scopeParam).toBe(DRIVE_SCOPES.join(" "));
    expect(scopeParam).not.toContain("https://www.googleapis.com/auth/drive ");
    expect(scopeParam?.split(" ")).toEqual([
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ]);
  });
});

describe("Google Drive client — request shaping + error handling", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shapes a read-only files.list search request with method GET, bearer auth, and an escaped 'q'", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ files: [] }), { status: 200 })
    );
    global.fetch = mockFetch;

    await searchFiles("access-token-123", "protocol's notes");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("https://www.googleapis.com/drive/v3/files?");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer access-token-123");

    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("q")).toContain("trashed = false");
    expect(parsed.searchParams.get("q")).toContain("protocol\\'s notes");
    expect(parsed.searchParams.get("fields")).toBe(
      "files(id,name,mimeType,modifiedTime,webViewLink)"
    );
  });

  it("returns the parsed files array from a successful search", async () => {
    const files = [
      { id: "f1", name: "Protocol.pdf", mimeType: "application/pdf", modifiedTime: "2026-01-01T00:00:00Z" },
    ];
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ files }), { status: 200 })
    );

    const result = await searchFiles("token", "Protocol");
    expect(result).toEqual(files);
  });

  it("throws DriveRateLimitError on a 429 response (search)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(searchFiles("token", "q")).rejects.toBeInstanceOf(DriveRateLimitError);
  });

  it("throws DriveAuthError on a 401/403 response (reconnect-needed path)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(getFileMetadata("token", "file-1")).rejects.toBeInstanceOf(DriveAuthError);
  });

  it("wraps a network failure in DriveApiError instead of throwing an unhandled exception", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(downloadFile("token", "file-1")).rejects.toBeInstanceOf(DriveApiError);
  });

  it("shapes files.create as a multipart POST with no target file id (cannot overwrite)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "new-file-1", name: "export.pdf" }), { status: 200 })
    );
    global.fetch = mockFetch;

    await createFile("token", "export.pdf", "application/pdf", Buffer.from("bytes"));

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/upload/drive/v3/files?uploadType=multipart");
    expect(String(url)).not.toMatch(/\/files\/[^?]+/); // no existing-file id in the path
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token");
  });

  it("propagates a non-ok, non-429/401/403 status as DriveApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(searchFiles("token", "q")).rejects.toBeInstanceOf(DriveApiError);
  });
});
