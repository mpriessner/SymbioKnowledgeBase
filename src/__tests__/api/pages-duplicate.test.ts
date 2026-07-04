import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const OTHER_TENANT_ID = "tenant-other-999";
const ROOT_ID = "a0000000-0000-4000-8000-000000000001";
const CHILD_ID = "a0000000-0000-4000-8000-000000000002";
const GRANDCHILD_ID = "a0000000-0000-4000-8000-000000000003";

// ── Prisma mock ──────────────────────────────────────────────────────────
// A single mutable store lets each test set up the rows the duplicate logic
// reads, and lets us count the create() calls the transaction issues.
const store = {
  pages: [] as Array<Record<string, unknown>>,
  blocks: [] as Array<Record<string, unknown>>,
  databaseCount: 0,
  createdPages: [] as Array<Record<string, unknown>>,
  createdBlocks: [] as Array<Record<string, unknown>>,
};

let uuidCounter = 0;
function nextId() {
  uuidCounter += 1;
  return `b0000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
}

vi.mock("@/lib/db", () => {
  const txClient = {
    page: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: nextId(), ...data };
        store.createdPages.push(created);
        return created;
      }),
    },
    block: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: nextId(), ...data };
        store.createdBlocks.push(created);
        return created;
      }),
    },
  };

  return {
    prisma: {
      page: {
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          return (
            store.pages.find(
              (p) =>
                p.id === where.id &&
                p.tenantId === where.tenantId &&
                (where.deletedAt === undefined || p.deletedAt == null)
            ) ?? null
          );
        }),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const idFilter = where?.id as { in?: string[] } | undefined;
          return store.pages.filter((p) => {
            if (p.tenantId !== where.tenantId) return false;
            if (where.deletedAt !== undefined && p.deletedAt != null) return false;
            if (idFilter?.in) return idFilter.in.includes(p.id as string);
            return true;
          });
        }),
        aggregate: vi.fn(async () => ({ _max: { position: 0 } })),
      },
      block: {
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const idFilter = where?.pageId as { in?: string[] } | undefined;
          return store.blocks
            .filter((b) => {
              if (b.tenantId !== where.tenantId) return false;
              if (idFilter?.in) return idFilter.in.includes(b.pageId as string);
              return true;
            })
            .sort((a, b) => (a.position as number) - (b.position as number));
        }),
      },
      database: {
        count: vi.fn(async () => store.databaseCount),
      },
      $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) =>
        cb(txClient)
      ),
    },
  };
});

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: Function) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const ctx = { tenantId: TENANT_ID, userId: "user-1" };
      const rc = routeContext ?? { params: Promise.resolve({}) };
      return handler(req, ctx, rc);
    };
  },
}));

vi.mock("@/lib/wikilinks/indexer", () => ({
  updatePageLinks: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/search/indexer", () => ({
  updateSearchIndexForPage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sync/SyncService", () => ({
  syncPageToFilesystem: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/pages/[id]/duplicate/route";
import { duplicatePage, DUPLICATE_PAGE_CAP } from "@/lib/pages/duplicatePage";

function resetStore() {
  store.pages = [];
  store.blocks = [];
  store.databaseCount = 0;
  store.createdPages = [];
  store.createdBlocks = [];
  uuidCounter = 0;
}

function page(overrides: Record<string, unknown>) {
  return {
    id: ROOT_ID,
    tenantId: TENANT_ID,
    parentId: null,
    title: "Root",
    icon: null,
    coverUrl: null,
    position: 0,
    spaceType: "PRIVATE",
    deletedAt: null,
    ...overrides,
  };
}

function block(overrides: Record<string, unknown>) {
  return {
    id: nextId(),
    pageId: ROOT_ID,
    tenantId: TENANT_ID,
    type: "PARAGRAPH",
    content: { type: "doc", content: [] },
    position: 0,
    plainText: "",
    deletedAt: null,
    ...overrides,
  };
}

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("duplicatePage — content clone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("clones the page row with '(copy)' title and preserves icon/cover", async () => {
    store.pages = [page({ title: "My Notes", icon: "📓", coverUrl: "https://x/y.png" })];
    store.blocks = [block({ position: 0, plainText: "hello" })];

    const result = await duplicatePage(TENANT_ID, ROOT_ID, { includeChildren: false });

    expect(result.ok).toBe(true);
    expect(store.createdPages).toHaveLength(1);
    expect(store.createdPages[0].title).toBe("My Notes (copy)");
    expect(store.createdPages[0].icon).toBe("📓");
    expect(store.createdPages[0].coverUrl).toBe("https://x/y.png");
    expect(store.createdPages[0].spaceType).toBe("PRIVATE");
  });

  it("clones ALL blocks in position order — not just the DOCUMENT block", async () => {
    store.pages = [page({})];
    store.blocks = [
      block({ pageId: ROOT_ID, type: "HEADING", position: 0, plainText: "Title" }),
      block({ pageId: ROOT_ID, type: "PARAGRAPH", position: 1, plainText: "Body" }),
      block({ pageId: ROOT_ID, type: "IMAGE", position: 2, plainText: "" }),
    ];

    await duplicatePage(TENANT_ID, ROOT_ID, { includeChildren: false });

    expect(store.createdBlocks).toHaveLength(3);
    expect(store.createdBlocks.map((b) => b.type)).toEqual([
      "HEADING",
      "PARAGRAPH",
      "IMAGE",
    ]);
    expect(store.createdBlocks.map((b) => b.position)).toEqual([0, 1, 2]);
    // Every cloned block points at the new page, not the original.
    const newPageId = store.createdPages[0].id;
    expect(store.createdBlocks.every((b) => b.pageId === newPageId)).toBe(true);
  });
});

describe("duplicatePage — subtree clone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("clones the whole subtree and re-parents copies onto their cloned parents", async () => {
    store.pages = [
      page({ id: ROOT_ID, parentId: null, title: "Root" }),
      page({ id: CHILD_ID, parentId: ROOT_ID, title: "Child" }),
      page({ id: GRANDCHILD_ID, parentId: CHILD_ID, title: "Grandchild" }),
    ];

    const result = await duplicatePage(TENANT_ID, ROOT_ID, { includeChildren: true });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pageCount).toBe(3);
    expect(store.createdPages).toHaveLength(3);

    // Root copy keeps original parent (null); descendants re-parent onto copies.
    const [rootCopy, childCopy, grandCopy] = store.createdPages;
    expect(rootCopy.title).toBe("Root (copy)");
    expect(rootCopy.parentId).toBeNull();
    expect(childCopy.title).toBe("Child"); // only root gets "(copy)"
    expect(childCopy.parentId).toBe(rootCopy.id);
    expect(grandCopy.parentId).toBe(childCopy.id);
  });

  it("clones only the root when includeChildren is false", async () => {
    store.pages = [
      page({ id: ROOT_ID, parentId: null }),
      page({ id: CHILD_ID, parentId: ROOT_ID }),
    ];

    const result = await duplicatePage(TENANT_ID, ROOT_ID, { includeChildren: false });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pageCount).toBe(1);
    expect(store.createdPages).toHaveLength(1);
  });
});

describe("duplicatePage — cap enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("rejects a subtree over the cap and persists ZERO rows", async () => {
    // Root + (cap) children = cap + 1 pages → over the limit.
    store.pages = [page({ id: ROOT_ID, parentId: null })];
    for (let i = 0; i < DUPLICATE_PAGE_CAP; i++) {
      store.pages.push(
        page({
          id: `c0000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          parentId: ROOT_ID,
          title: `Child ${i}`,
        })
      );
    }

    const result = await duplicatePage(TENANT_ID, ROOT_ID, { includeChildren: true });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CAP_EXCEEDED");
    // Nothing was written — the cap is checked before the transaction.
    expect(store.createdPages).toHaveLength(0);
    expect(store.createdBlocks).toHaveLength(0);
  });
});

describe("duplicatePage — database-backed pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("duplicates without the database and flags databaseSkipped", async () => {
    store.pages = [page({})];
    store.databaseCount = 1;

    const result = await duplicatePage(TENANT_ID, ROOT_ID, { includeChildren: false });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.databaseSkipped).toBe(true);
    // Only the page row is cloned; no database create is attempted.
    expect(store.createdPages).toHaveLength(1);
  });
});

describe("POST /api/pages/[id]/duplicate — route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("returns 201 with the new root id", async () => {
    store.pages = [page({})];

    const req = new NextRequest(`http://localhost/api/pages/${ROOT_ID}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeChildren: true }),
    });
    const res = await POST(req, makeRouteContext(ROOT_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(store.createdPages[0].id);
    expect(body.data.databaseSkipped).toBe(false);
  });

  it("404s when the page belongs to another tenant", async () => {
    // Row exists but under a different tenant → findFirst (scoped to TENANT_ID) misses it.
    store.pages = [page({ tenantId: OTHER_TENANT_ID })];

    const req = new NextRequest(`http://localhost/api/pages/${ROOT_ID}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeChildren: true }),
    });
    const res = await POST(req, makeRouteContext(ROOT_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(store.createdPages).toHaveLength(0);
  });

  it("400s on an invalid page id", async () => {
    const req = new NextRequest("http://localhost/api/pages/not-a-uuid/duplicate", {
      method: "POST",
    });
    const res = await POST(req, makeRouteContext("not-a-uuid") as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("413s when the subtree exceeds the cap", async () => {
    store.pages = [page({ id: ROOT_ID, parentId: null })];
    for (let i = 0; i < DUPLICATE_PAGE_CAP; i++) {
      store.pages.push(
        page({
          id: `c0000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          parentId: ROOT_ID,
        })
      );
    }

    const req = new NextRequest(`http://localhost/api/pages/${ROOT_ID}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeChildren: true }),
    });
    const res = await POST(req, makeRouteContext(ROOT_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(store.createdPages).toHaveLength(0);
  });
});
