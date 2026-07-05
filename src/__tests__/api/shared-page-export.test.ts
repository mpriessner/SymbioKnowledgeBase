import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TOKEN = "abcdef0123456789abcdef01"; // 24 hex-ish chars, shape-agnostic here

const baseShareLink = {
  id: "share-1",
  pageId: "page-1",
  tenantId: "tenant-1",
  token: TOKEN,
  createdBy: "user-1",
  allowIndexing: false,
  publishedAt: new Date("2026-01-01"),
  expiresAt: new Date("2099-01-01"),
  revokedAt: null as Date | null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  createdByUser: { name: "Ada Lovelace" },
  page: {
    id: "page-1",
    tenantId: "tenant-1",
    title: "Test Page",
    icon: null,
    externalId: "exp-123",
    teamspace: { name: "Chemistry" },
    blocks: [
      {
        id: "block-1",
        type: "DOCUMENT",
        position: 0,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hello world" }],
            },
          ],
        },
      },
    ],
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    publicShareLink: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from "@/app/shared/[token]/export/route";
import { prisma } from "@/lib/db";

function makeRouteContext(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /shared/[token]/export (format=json|text)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 application/json with {title, markdown, externalId} for a live token", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce(
      baseShareLink as never
    );

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=json`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual({
      title: "Test Page",
      markdown: expect.stringContaining("Hello world"),
      externalId: "exp-123",
    });
  });

  it("returns 200 text/plain with the same markdown body for format=text", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce(
      baseShareLink as never
    );

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=text`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toContain("Hello world");
  });

  it("returns externalId: null when the page has no externalId", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce({
      ...baseShareLink,
      page: { ...baseShareLink.page, externalId: null },
    } as never);

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=json`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);
    const body = await res.json();

    expect(body.externalId).toBeNull();
  });

  it("404s for a revoked token (format=json)", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce({
      ...baseShareLink,
      revokedAt: new Date("2026-02-01"),
    } as never);

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=json`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);

    expect(res.status).toBe(404);
  });

  it("404s for a revoked token (format=text)", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce({
      ...baseShareLink,
      revokedAt: new Date("2026-02-01"),
    } as never);

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=text`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);

    expect(res.status).toBe(404);
  });

  it("404s for an expired token", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce({
      ...baseShareLink,
      expiresAt: new Date("2000-01-01"),
    } as never);

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=json`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);

    expect(res.status).toBe(404);
  });

  it("404s for an unknown token", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce(
      null as never
    );

    const req = new NextRequest(
      `http://localhost/shared/${TOKEN}/export?format=json`
    );
    const res = await GET(req, makeRouteContext(TOKEN) as never);

    expect(res.status).toBe(404);
  });
});
