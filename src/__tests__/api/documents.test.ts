import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockTeamspaceFindFirst = vi.fn();
const mockPageAggregate = vi.fn();
const mockPageCreate = vi.fn();
const mockBlockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    teamspace: { findFirst: (...args: unknown[]) => mockTeamspaceFindFirst(...args) },
    page: {
      aggregate: (...args: unknown[]) => mockPageAggregate(...args),
      create: (...args: unknown[]) => mockPageCreate(...args),
    },
    block: { create: (...args: unknown[]) => mockBlockCreate(...args) },
  },
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant:
    (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest) =>
      handler(req, { tenantId: "tenant-1", userId: "user-1", role: "OWNER" }),
}));

vi.mock("@/lib/documents/urlSnapshot", () => ({
  validateUrlScheme: vi.fn(() => ({ ok: true })),
  fetchUrlSnapshot: vi.fn(async () => ({
    fetchable: true,
    snapshot: "Fetched browser-session snapshot.",
  })),
}));

import { POST } from "@/app/api/documents/route";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageAggregate.mockResolvedValue({ _max: { position: null } });
    mockPageCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: "document-page-1",
        title: data.title,
        parentId: null,
        sourceUrl: data.sourceUrl ?? null,
        createdAt: new Date("2026-07-15T12:00:00.000Z"),
      })
    );
    mockBlockCreate.mockResolvedValue({ id: "block-1" });
  });

  it("creates a searchable upload document for the signed-in user", async () => {
    const response = await POST(
      request({ title: "Browser upload", space: "private", source: "upload", tags: [] })
    );

    expect(response.status).toBe(201);
    expect(mockPageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Browser upload",
          kind: "DOCUMENT",
          docSource: "upload",
          spaceType: "PRIVATE",
        }),
      })
    );
    expect(mockBlockCreate.mock.calls[0][0].data.plainText).toContain("Browser upload");
  });

  it("creates a URL document with a fetched snapshot", async () => {
    const response = await POST(
      request({
        title: "Browser link",
        space: "private",
        source: "url",
        url: "https://example.com/protocol",
        tags: [],
      })
    );

    expect(response.status).toBe(201);
    expect(mockBlockCreate.mock.calls[0][0].data.plainText).toContain(
      "Fetched browser-session snapshot"
    );
  });

  it("rejects a teamspace outside the signed-in user's tenant", async () => {
    mockTeamspaceFindFirst.mockResolvedValue(null);
    const response = await POST(
      request({
        title: "Foreign team doc",
        space: "team",
        teamspace_id: "22222222-2222-4222-8222-222222222222",
        source: "upload",
      })
    );

    expect(response.status).toBe(404);
    expect(mockPageCreate).not.toHaveBeenCalled();
  });
});
