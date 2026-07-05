// @vitest-environment node
//
// This suite exercises multipart/form-data parsing via NextRequest, which
// relies on undici's File/FormData. jsdom (the project default test
// environment) provides its own incompatible File/FormData globals that
// NextRequest.formData() cannot parse, so this file opts into the Node
// environment instead.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";
const PAGE_ID = "page-doc-1";

const mockPageFindFirst = vi.fn();
const mockBlockFindFirst = vi.fn();
const mockBlockUpdate = vi.fn();
const mockBlockCreate = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockStoreAttachment = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
      update: (...args: unknown[]) => mockBlockUpdate(...args),
      create: (...args: unknown[]) => mockBlockCreate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("@/lib/agent/auth", () => ({
  withAgentAuth: (
    handler: (req: NextRequest, ctx: unknown, rc: unknown) => Promise<Response>
  ) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const ctx = {
        tenantId: TENANT_ID,
        userId: USER_ID,
        apiKeyId: "key-1",
        scopes: ["read", "write"],
      };
      const rc = routeContext ?? { params: Promise.resolve({}) };
      return handler(req, ctx, rc);
    };
  },
}));

vi.mock("@/lib/sync/attachments", () => ({
  storeAttachment: (...args: unknown[]) => mockStoreAttachment(...args),
}));

import { POST } from "@/app/api/agent/pages/[id]/attachments/route";

function multipartReq(file: File): NextRequest {
  const formData = new FormData();
  formData.set("file", file);
  return new NextRequest(
    `http://localhost:3000/api/agent/pages/${PAGE_ID}/attachments`,
    { method: "POST", body: formData }
  );
}

function routeContext(id: string = PAGE_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/agent/pages/:id/attachments (a71-08 AC4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({});
  });

  it("404s when the page does not exist in the caller's tenant", async () => {
    mockPageFindFirst.mockResolvedValue(null);

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const res = await POST(multipartReq(file), routeContext());

    expect(res.status).toBe(404);
    expect(mockStoreAttachment).not.toHaveBeenCalled();
  });

  it("rejects uploads to a non-document page (blast-radius containment)", async () => {
    mockPageFindFirst.mockResolvedValue({ id: PAGE_ID, kind: "PAGE" });

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const res = await POST(multipartReq(file), routeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockStoreAttachment).not.toHaveBeenCalled();
  });

  it("uploads to a document page, links the url reference into the body, and audit-logs (AC4)", async () => {
    mockPageFindFirst.mockResolvedValue({ id: PAGE_ID, kind: "DOCUMENT" });
    mockStoreAttachment.mockResolvedValue({
      attachmentId: "attach-1",
      relativePath: "./Doc/assets/report.pdf",
    });
    mockBlockFindFirst.mockResolvedValue({
      id: "block-1",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "# Report" }] }] },
    });
    mockBlockUpdate.mockResolvedValue({ id: "block-1" });

    const file = new File(["file bytes"], "report.pdf", {
      type: "application/pdf",
    });
    const res = await POST(multipartReq(file), routeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    // Must reference the browser-facing `url`, not the mirror-relative path
    // (Round 2 finding 6 / reference-format correction).
    expect(body.data.url).toBe("/api/attachments/attach-1");
    expect(body.data.attachmentId).toBe("attach-1");

    expect(mockBlockUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockBlockUpdate.mock.calls[0][0];
    const updatedContentStr = JSON.stringify(updateArgs.data.content);
    expect(updatedContentStr).toContain("/api/attachments/attach-1");
    expect(updatedContentStr).not.toContain("./Doc/assets/report.pdf");
    expect(updateArgs.data.plainText).toContain("report.pdf");

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
  });

  it("creates a new DOCUMENT block referencing the url when the page has no existing block", async () => {
    mockPageFindFirst.mockResolvedValue({ id: PAGE_ID, kind: "DOCUMENT" });
    mockStoreAttachment.mockResolvedValue({
      attachmentId: "attach-2",
      relativePath: "./Doc/assets/report2.pdf",
    });
    mockBlockFindFirst.mockResolvedValue(null);
    mockBlockCreate.mockResolvedValue({ id: "block-2" });

    const file = new File(["file bytes"], "report2.pdf", {
      type: "application/pdf",
    });
    const res = await POST(multipartReq(file), routeContext());

    expect(res.status).toBe(201);
    expect(mockBlockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockBlockCreate.mock.calls[0][0];
    expect(JSON.stringify(createArgs.data.content)).toContain(
      "/api/attachments/attach-2"
    );
    expect(createArgs.data.plainText).toContain("report2.pdf");
  });

  it("rejects a file over the 50MB cap without calling storeAttachment (AC6)", async () => {
    mockPageFindFirst.mockResolvedValue({ id: PAGE_ID, kind: "DOCUMENT" });

    const big = new Uint8Array(50 * 1024 * 1024 + 1);
    const file = new File([big], "huge.bin", {
      type: "application/octet-stream",
    });
    const res = await POST(multipartReq(file), routeContext());

    expect(res.status).toBe(400);
    expect(mockStoreAttachment).not.toHaveBeenCalled();
  });
});
