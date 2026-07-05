import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";
const TEAMSPACE_ID = "22222222-2222-4222-8222-222222222222";

const mockTeamspaceFindFirst = vi.fn();
const mockPageAggregate = vi.fn();
const mockPageCreate = vi.fn();
const mockBlockCreate = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    teamspace: {
      findFirst: (...args: unknown[]) => mockTeamspaceFindFirst(...args),
    },
    page: {
      aggregate: (...args: unknown[]) => mockPageAggregate(...args),
      create: (...args: unknown[]) => mockPageCreate(...args),
    },
    block: {
      create: (...args: unknown[]) => mockBlockCreate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

// Bypass scope/rate-limit machinery here — that's covered by
// src/__tests__/lib/auth/agentAuth.test.ts. This suite is about the route's
// own business logic.
vi.mock("@/lib/agent/auth", () => ({
  withAgentAuth: (handler: (req: NextRequest, ctx: unknown, rc: unknown) => Promise<Response>) => {
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

vi.mock("@/lib/documents/urlSnapshot", () => ({
  validateUrlScheme: vi.fn(() => ({ ok: true })),
  fetchUrlSnapshot: vi.fn(async () => ({
    fetchable: true,
    snapshot: "Fetched snapshot text.",
  })),
}));

import { POST } from "@/app/api/agent/documents/route";
import { validateUrlScheme, fetchUrlSnapshot } from "@/lib/documents/urlSnapshot";

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/documents (a71-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateUrlScheme).mockReturnValue({ ok: true });
    vi.mocked(fetchUrlSnapshot).mockResolvedValue({
      fetchable: true,
      snapshot: "Fetched snapshot text.",
    });

    mockPageAggregate.mockResolvedValue({ _max: { position: null } });
    mockPageCreate.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "page-doc-1",
          title: data.title,
          parentId: null,
          sourceUrl: data.sourceUrl ?? null,
          createdAt: new Date("2026-07-05T00:00:00.000Z"),
        })
    );
    mockBlockCreate.mockResolvedValue({ id: "block-1" });
    mockAuditLogCreate.mockResolvedValue({});
  });

  it("creates a document page for source: upload with kind='DOCUMENT' and populated plainText (AC1, AC5)", async () => {
    const res = await POST(
      req({
        title: "Safety Data Sheet",
        space: "private",
        source: "upload",
        tags: ["safety"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe("page-doc-1");
    expect(body.data.kind).toBe("document");

    expect(mockPageCreate).toHaveBeenCalledTimes(1);
    const pageCreateArgs = mockPageCreate.mock.calls[0][0];
    expect(pageCreateArgs.data.kind).toBe("DOCUMENT");
    expect(pageCreateArgs.data.spaceType).toBe("PRIVATE");
    expect(pageCreateArgs.data.docSource).toBe("upload");

    expect(mockBlockCreate).toHaveBeenCalledTimes(1);
    const blockCreateArgs = mockBlockCreate.mock.calls[0][0];
    // Search-indexing requirement (Round 2 finding 1 / AC5): plainText must
    // be populated at creation time with real body content, not left empty.
    expect(blockCreateArgs.data.plainText).toContain("Safety Data Sheet");
    expect(blockCreateArgs.data.plainText).toContain("Summary");

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
  });

  it("creates a document page for source: url and folds the fetched snapshot into plainText (AC2, AC5)", async () => {
    const res = await POST(
      req({
        title: "Vendor Spec",
        space: "private",
        source: "url",
        url: "https://vendor.example.com/spec.pdf",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(fetchUrlSnapshot).toHaveBeenCalledWith(
      "https://vendor.example.com/spec.pdf"
    );
    expect(body.data.fetchable).toBe(true);

    const blockCreateArgs = mockBlockCreate.mock.calls[0][0];
    expect(blockCreateArgs.data.plainText).toContain("Fetched snapshot text");
  });

  it("still creates a link-only page when the snapshot fetch fails (non-fatal, AC2)", async () => {
    vi.mocked(fetchUrlSnapshot).mockResolvedValueOnce({
      fetchable: false,
      error: "timed out",
    });

    const res = await POST(
      req({
        title: "Unfetchable link",
        space: "private",
        source: "url",
        url: "https://slow.example.com/doc",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.fetchable).toBe(false);
    expect(mockPageCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects a disallowed URL scheme before any fetch is attempted (AC7)", async () => {
    vi.mocked(validateUrlScheme).mockReturnValueOnce({
      ok: false,
      reason: "Unsupported URL scheme",
    });

    const res = await POST(
      req({
        title: "Bad link",
        space: "private",
        source: "url",
        url: "javascript:alert(1)",
      })
    );

    expect(res.status).toBe(400);
    expect(fetchUrlSnapshot).not.toHaveBeenCalled();
    expect(mockPageCreate).not.toHaveBeenCalled();
  });

  it("rejects a teamspace_id that does not belong to the caller's tenant (AC8)", async () => {
    mockTeamspaceFindFirst.mockResolvedValue(null);

    const res = await POST(
      req({
        title: "Team doc",
        space: "team",
        teamspace_id: TEAMSPACE_ID,
        source: "upload",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(mockPageCreate).not.toHaveBeenCalled();
    expect(mockTeamspaceFindFirst).toHaveBeenCalledWith({
      where: { id: TEAMSPACE_ID, tenantId: TENANT_ID },
    });
  });

  it("accepts a teamspace_id that does belong to the caller's tenant", async () => {
    mockTeamspaceFindFirst.mockResolvedValue({
      id: TEAMSPACE_ID,
      tenantId: TENANT_ID,
    });

    const res = await POST(
      req({
        title: "Team doc",
        space: "team",
        teamspace_id: TEAMSPACE_ID,
        source: "upload",
      })
    );

    expect(res.status).toBe(201);
    expect(mockPageCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when space is 'team' but teamspace_id is missing", async () => {
    const res = await POST(req({ title: "x", space: "team", source: "upload" }));
    expect(res.status).toBe(400);
    expect(mockPageCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when source is 'url' but url is missing", async () => {
    const res = await POST(req({ title: "x", space: "private", source: "url" }));
    expect(res.status).toBe(400);
    expect(mockPageCreate).not.toHaveBeenCalled();
  });
});
