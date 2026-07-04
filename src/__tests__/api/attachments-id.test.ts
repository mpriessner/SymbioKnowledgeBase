import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const ATTACHMENT_ID = "b0000000-0000-4000-8000-000000000001";

vi.mock("@/lib/db", () => ({
  prisma: {
    fileAttachment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: Function) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const ctx = { tenantId: TENANT_ID, userId: "user-1" };
      const rc = routeContext ?? { params: Promise.resolve({}) };
      return handler(req, ctx, rc);
    };
  },
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
  },
}));

import { GET } from "@/app/api/attachments/[id]/route";
import { prisma } from "@/lib/db";
import fs from "fs/promises";

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const imageAttachment = {
  id: ATTACHMENT_ID,
  tenantId: TENANT_ID,
  fileName: "photo.png",
  mimeType: "image/png",
  storagePath: `${TENANT_ID}/Page/assets/photo.png`,
};

const pdfAttachment = {
  ...imageAttachment,
  fileName: "report.pdf",
  mimeType: "application/pdf",
  storagePath: `${TENANT_ID}/Page/assets/report.pdf`,
};

describe("GET /api/attachments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an invalid UUID", async () => {
    const req = new NextRequest("http://localhost/api/attachments/not-a-uuid");
    const res = await GET(req, makeRouteContext("not-a-uuid") as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when the attachment is missing or belongs to another tenant", async () => {
    // findFirst is tenant-scoped, so a cross-tenant id resolves to null.
    vi.mocked(prisma.fileAttachment.findFirst).mockResolvedValueOnce(
      null as never
    );

    const req = new NextRequest(
      `http://localhost/api/attachments/${ATTACHMENT_ID}`
    );
    const res = await GET(req, makeRouteContext(ATTACHMENT_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    // The lookup must be scoped to the caller's tenant.
    const whereArg = vi.mocked(prisma.fileAttachment.findFirst).mock
      .calls[0][0] as { where: { tenantId: string } };
    expect(whereArg.where.tenantId).toBe(TENANT_ID);
  });

  it("serves an image inline with the correct Content-Type", async () => {
    vi.mocked(prisma.fileAttachment.findFirst).mockResolvedValueOnce(
      imageAttachment as never
    );
    vi.mocked(fs.readFile).mockResolvedValueOnce(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]) as never
    );

    const req = new NextRequest(
      `http://localhost/api/attachments/${ATTACHMENT_ID}`
    );
    const res = await GET(req, makeRouteContext(ATTACHMENT_ID) as never);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("Content-Disposition")).toContain("photo.png");
  });

  it("serves a non-image as an attachment download", async () => {
    vi.mocked(prisma.fileAttachment.findFirst).mockResolvedValueOnce(
      pdfAttachment as never
    );
    vi.mocked(fs.readFile).mockResolvedValueOnce(
      Buffer.from([0x25, 0x50, 0x44, 0x46]) as never
    );

    const req = new NextRequest(
      `http://localhost/api/attachments/${ATTACHMENT_ID}`
    );
    const res = await GET(req, makeRouteContext(ATTACHMENT_ID) as never);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("report.pdf");
  });

  it("returns 404 when the file is missing on disk", async () => {
    vi.mocked(prisma.fileAttachment.findFirst).mockResolvedValueOnce(
      imageAttachment as never
    );
    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error("ENOENT") as never
    );

    const req = new NextRequest(
      `http://localhost/api/attachments/${ATTACHMENT_ID}`
    );
    const res = await GET(req, makeRouteContext(ATTACHMENT_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
