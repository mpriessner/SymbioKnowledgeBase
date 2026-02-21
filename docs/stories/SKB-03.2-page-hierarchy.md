# Story SKB-03.2: Page Hierarchy and Nested Pages

**Epic:** Epic 3 - Page Management & Navigation
**Story ID:** SKB-03.2
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-03.1 (Page CRUD API must exist)

---

## User Story

As a researcher, I want to organize pages in a nested hierarchy, So that I can structure my knowledge by topic and subtopic.

---

## Acceptance Criteria

- [ ] Creating a page with `parentId` in `POST /api/pages` correctly sets the parent-child relationship
- [ ] Updating `parentId` via `PUT /api/pages/[id]` moves a page to a new parent
- [ ] `GET /api/pages?parentId=X` returns only direct children of page X
- [ ] `GET /api/pages?parentId=null` returns only root-level pages (pages with no parent)
- [ ] `GET /api/pages/tree` returns the full page tree as a nested JSON structure for the sidebar
- [ ] A page cannot be set as its own parent (returns 400)
- [ ] A page cannot be moved to one of its own descendants (circular reference detection, returns 400)
- [ ] Moving a page to a new parent assigns it the next available position among its new siblings
- [ ] The tree endpoint respects tenant isolation (only returns pages belonging to the authenticated tenant)
- [ ] The tree structure includes `children` arrays with recursive nesting at all levels

---

## Architecture Overview

```
Page Hierarchy Model (parent_id self-reference):

Root (parent_id = null)
├── Getting Started (parent_id = null, position = 0)
├── User Guide (parent_id = null, position = 1)
│   ├── Installation (parent_id = User Guide, position = 0)
│   ├── Configuration (parent_id = User Guide, position = 1)
│   └── Troubleshooting (parent_id = User Guide, position = 2)
│       └── Common Errors (parent_id = Troubleshooting, position = 0)
└── API Docs (parent_id = null, position = 2)
    └── REST API (parent_id = API Docs, position = 0)

Flat DB Rows → Nested Tree Transformation:

┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL: SELECT * FROM pages WHERE tenant_id = $1       │
│              ORDER BY position ASC                           │
│                                                              │
│  Returns FLAT list:                                          │
│  [                                                           │
│    { id: "a", parent_id: null, title: "Getting Started" },  │
│    { id: "b", parent_id: null, title: "User Guide" },       │
│    { id: "c", parent_id: "b",  title: "Installation" },     │
│    { id: "d", parent_id: "b",  title: "Configuration" },    │
│    { id: "e", parent_id: null, title: "API Docs" },         │
│    { id: "f", parent_id: "e",  title: "REST API" },         │
│  ]                                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │  buildPageTree()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Nested Tree:                                                │
│  [                                                           │
│    { id: "a", title: "Getting Started", children: [] },      │
│    { id: "b", title: "User Guide", children: [              │
│        { id: "c", title: "Installation", children: [] },    │
│        { id: "d", title: "Configuration", children: [] },   │
│    ]},                                                       │
│    { id: "e", title: "API Docs", children: [                │
│        { id: "f", title: "REST API", children: [] },        │
│    ]},                                                       │
│  ]                                                           │
└─────────────────────────────────────────────────────────────┘

Circular Reference Detection:

Page X → wants parent = Page Y
  └── Check: is Y a descendant of X?
      └── Walk from Y upward through parent_id chain
      └── If we encounter X → CIRCULAR → reject with 400
      └── If we reach null (root) → SAFE → allow move

┌──────────┐
│  Page A   │ ← root
│  parent=∅ │
└────┬──────┘
     │
┌────▼──────┐
│  Page B   │
│  parent=A │
└────┬──────┘
     │
┌────▼──────┐
│  Page C   │
│  parent=B │
└───────────┘

Moving A under C?  Walk up from C: C→B→A → found A! → CIRCULAR → 400
Moving C under A?  Walk up from A: A→null → no C found → SAFE → allow
```

---

## Implementation Steps

### Step 1: Create the Page Tree Builder Utility

This utility transforms a flat list of page records into a nested tree structure. It uses a single-pass hash map approach for O(n) performance regardless of tree depth.

**File: `src/lib/pages/getPageTree.ts`**

```typescript
import { prisma } from "@/lib/db";
import type { PageTreeNode } from "@/types/page";

interface PageRow {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Transforms a flat array of page records into a nested tree structure.
 * Uses a single-pass hash map approach — O(n) time complexity.
 *
 * Algorithm:
 * 1. Create a map of id → node (with empty children array)
 * 2. Iterate all nodes, push each into its parent's children array
 * 3. Return only root nodes (parent_id === null)
 */
export function buildPageTree(pages: PageRow[]): PageTreeNode[] {
  const nodeMap = new Map<string, PageTreeNode>();

  // First pass: create all nodes
  for (const page of pages) {
    nodeMap.set(page.id, {
      id: page.id,
      tenantId: page.tenant_id,
      parentId: page.parent_id,
      title: page.title,
      icon: page.icon,
      coverUrl: page.cover_url,
      position: page.position,
      createdAt: page.created_at.toISOString(),
      updatedAt: page.updated_at.toISOString(),
      children: [],
    });
  }

  const roots: PageTreeNode[] = [];

  // Second pass: link children to parents
  for (const page of pages) {
    const node = nodeMap.get(page.id);
    if (!node) continue;

    if (page.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(page.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan page — parent does not exist, treat as root
        roots.push(node);
      }
    }
  }

  // Sort children by position at each level
  function sortChildren(nodes: PageTreeNode[]): void {
    nodes.sort((a, b) => a.position - b.position);
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  }

  sortChildren(roots);

  return roots;
}

/**
 * Fetches all pages for a tenant and returns them as a nested tree.
 */
export async function getPageTree(tenantId: string): Promise<PageTreeNode[]> {
  const pages = await prisma.page.findMany({
    where: { tenant_id: tenantId },
    orderBy: { position: "asc" },
  });

  return buildPageTree(pages);
}

/**
 * Checks whether `targetId` is a descendant of `ancestorId`.
 * Used for circular reference detection when moving pages.
 *
 * Walks upward from targetId through parent_id chain.
 * Returns true if ancestorId is found (circular), false otherwise.
 */
export async function isDescendant(
  tenantId: string,
  ancestorId: string,
  targetId: string
): Promise<boolean> {
  let currentId: string | null = targetId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true;
    }

    // Prevent infinite loops from corrupted data
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    const page = await prisma.page.findFirst({
      where: { id: currentId, tenant_id: tenantId },
      select: { parent_id: true },
    });

    currentId = page?.parent_id ?? null;
  }

  return false;
}

/**
 * Returns the ancestry chain for a given page (from root down to the page).
 * Useful for breadcrumbs.
 */
export async function getPageAncestry(
  tenantId: string,
  pageId: string
): Promise<{ id: string; title: string; icon: string | null }[]> {
  const ancestors: { id: string; title: string; icon: string | null }[] = [];
  let currentId: string | null = pageId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const page = await prisma.page.findFirst({
      where: { id: currentId, tenant_id: tenantId },
      select: { id: true, title: true, icon: true, parent_id: true },
    });

    if (!page) break;

    ancestors.unshift({ id: page.id, title: page.title, icon: page.icon });
    currentId = page.parent_id;
  }

  return ancestors;
}
```

---

### Step 2: Create the Page Tree API Endpoint

This endpoint returns the full page tree as a nested structure, ready for the sidebar component. It fetches all pages for the tenant in a single query, then transforms them into a tree in memory.

**File: `src/app/api/pages/tree/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { getPageTree } from "@/lib/pages/getPageTree";
import { TenantContext } from "@/types/auth";

export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext) => {
    try {
      const tree = await getPageTree(context.tenantId);

      return successResponse(tree);
    } catch (error) {
      console.error("GET /api/pages/tree error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);
```

---

### Step 3: Update the PUT Endpoint with Circular Reference Detection

Enhance the existing PUT handler from SKB-03.1 to detect and reject circular parent references when updating `parentId`.

**Additions to `src/app/api/pages/[id]/route.ts` — PUT handler:**

```typescript
// Add import at top of file:
import { isDescendant } from "@/lib/pages/getPageTree";

// Inside the PUT handler, after the "cannot set a page as its own parent" check,
// add circular reference detection:

export const PUT = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse(400, "Invalid page ID");
      }

      const body = await req.json();
      const parsed = updatePageSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          400,
          "Invalid request body",
          parsed.error.flatten().fieldErrors
        );
      }

      // Verify the page exists and belongs to this tenant
      const existingPage = await prisma.page.findFirst({
        where: { id: idParsed.data, tenant_id: context.tenantId },
      });
      if (!existingPage) {
        return errorResponse(404, "Page not found");
      }

      const { title, parentId, icon, coverUrl } = parsed.data;

      // Validate parent change
      if (parentId !== undefined && parentId !== null) {
        // Cannot set a page as its own parent
        if (parentId === idParsed.data) {
          return errorResponse(400, "A page cannot be its own parent");
        }

        // Verify the target parent exists
        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenant_id: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse(404, "Parent page not found");
        }

        // Check for circular reference: is the target parent a descendant of this page?
        const circular = await isDescendant(
          context.tenantId,
          idParsed.data,
          parentId
        );
        if (circular) {
          return errorResponse(
            400,
            "Cannot move a page under one of its own descendants (circular reference)"
          );
        }
      }

      // If parentId is changing, calculate the new position among new siblings
      const updateData: Record<string, unknown> = {
        updated_at: new Date(),
      };

      if (title !== undefined) updateData.title = title;
      if (icon !== undefined) updateData.icon = icon;
      if (coverUrl !== undefined) updateData.cover_url = coverUrl;

      if (parentId !== undefined) {
        updateData.parent_id = parentId;

        // Assign the next available position among new siblings
        const maxPosition = await prisma.page.aggregate({
          where: {
            tenant_id: context.tenantId,
            parent_id: parentId,
            id: { not: idParsed.data }, // exclude the page being moved
          },
          _max: { position: true },
        });
        updateData.position = (maxPosition._max.position ?? -1) + 1;
      }

      const updatedPage = await prisma.page.update({
        where: { id: idParsed.data },
        data: updateData,
      });

      return successResponse(serializePage(updatedPage));
    } catch (error) {
      console.error("PUT /api/pages/[id] error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);
```

---

### Step 4: Create TanStack Query Hook for Page Tree

**File: `src/hooks/usePageTree.ts`**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import type { PageTreeNode } from "@/types/page";
import { pageKeys } from "@/hooks/usePages";

interface PageTreeResponse {
  data: PageTreeNode[];
  meta: Record<string, unknown>;
}

async function fetchPageTree(): Promise<PageTreeResponse> {
  const response = await fetch("/api/pages/tree");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch page tree");
  }
  return response.json();
}

/**
 * Fetches the full page tree for the current tenant.
 * Returns a nested structure suitable for rendering the sidebar.
 */
export function usePageTree() {
  return useQuery({
    queryKey: pageKeys.tree(),
    queryFn: fetchPageTree,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Utility: find a page node within the tree by ID.
 * Performs a depth-first search through the nested structure.
 */
export function findPageInTree(
  nodes: PageTreeNode[],
  pageId: string
): PageTreeNode | null {
  for (const node of nodes) {
    if (node.id === pageId) return node;
    if (node.children.length > 0) {
      const found = findPageInTree(node.children, pageId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Utility: get the ancestry path (root to page) from the tree.
 * Returns an array of { id, title, icon } from root ancestor down to the page.
 */
export function getAncestryFromTree(
  nodes: PageTreeNode[],
  pageId: string
): { id: string; title: string; icon: string | null }[] {
  function search(
    currentNodes: PageTreeNode[],
    path: { id: string; title: string; icon: string | null }[]
  ): { id: string; title: string; icon: string | null }[] | null {
    for (const node of currentNodes) {
      const currentPath = [
        ...path,
        { id: node.id, title: node.title, icon: node.icon },
      ];
      if (node.id === pageId) {
        return currentPath;
      }
      if (node.children.length > 0) {
        const result = search(node.children, currentPath);
        if (result) return result;
      }
    }
    return null;
  }

  return search(nodes, []) || [];
}
```

---

## Testing Requirements

### Unit Tests: Tree Building and Circular Reference Detection

**File: `src/__tests__/lib/pages/getPageTree.test.ts`**

```typescript
import { describe, test, expect } from "vitest";
import { buildPageTree } from "@/lib/pages/getPageTree";

// Helper to create a mock page row
function mockPage(overrides: Partial<{
  id: string;
  tenant_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
}>) {
  return {
    id: overrides.id ?? "page-1",
    tenant_id: overrides.tenant_id ?? "tenant-1",
    parent_id: overrides.parent_id ?? null,
    title: overrides.title ?? "Untitled",
    icon: overrides.icon ?? null,
    cover_url: overrides.cover_url ?? null,
    position: overrides.position ?? 0,
    created_at: overrides.created_at ?? new Date("2026-01-01"),
    updated_at: overrides.updated_at ?? new Date("2026-01-01"),
  };
}

describe("buildPageTree", () => {
  test("returns empty array for empty input", () => {
    const tree = buildPageTree([]);
    expect(tree).toEqual([]);
  });

  test("returns flat list as root nodes when all have null parent_id", () => {
    const pages = [
      mockPage({ id: "a", title: "Page A", position: 0 }),
      mockPage({ id: "b", title: "Page B", position: 1 }),
      mockPage({ id: "c", title: "Page C", position: 2 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(3);
    expect(tree[0].title).toBe("Page A");
    expect(tree[1].title).toBe("Page B");
    expect(tree[2].title).toBe("Page C");
    expect(tree[0].children).toEqual([]);
  });

  test("nests children under their parent", () => {
    const pages = [
      mockPage({ id: "parent", title: "Parent", position: 0 }),
      mockPage({ id: "child-1", parent_id: "parent", title: "Child 1", position: 0 }),
      mockPage({ id: "child-2", parent_id: "parent", title: "Child 2", position: 1 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe("Parent");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].title).toBe("Child 1");
    expect(tree[0].children[1].title).toBe("Child 2");
  });

  test("handles deeply nested structures (3+ levels)", () => {
    const pages = [
      mockPage({ id: "root", title: "Root", position: 0 }),
      mockPage({ id: "l1", parent_id: "root", title: "Level 1", position: 0 }),
      mockPage({ id: "l2", parent_id: "l1", title: "Level 2", position: 0 }),
      mockPage({ id: "l3", parent_id: "l2", title: "Level 3", position: 0 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].children[0].title).toBe("Level 3");
  });

  test("sorts children by position at each level", () => {
    const pages = [
      mockPage({ id: "parent", title: "Parent", position: 0 }),
      mockPage({ id: "child-b", parent_id: "parent", title: "B", position: 2 }),
      mockPage({ id: "child-a", parent_id: "parent", title: "A", position: 0 }),
      mockPage({ id: "child-c", parent_id: "parent", title: "C", position: 1 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree[0].children[0].title).toBe("A");
    expect(tree[0].children[1].title).toBe("C");
    expect(tree[0].children[2].title).toBe("B");
  });

  test("treats orphan pages (missing parent) as root nodes", () => {
    const pages = [
      mockPage({ id: "orphan", parent_id: "nonexistent", title: "Orphan", position: 0 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe("Orphan");
  });

  test("handles multiple root pages with children", () => {
    const pages = [
      mockPage({ id: "root-1", title: "Root 1", position: 0 }),
      mockPage({ id: "root-2", title: "Root 2", position: 1 }),
      mockPage({ id: "child-1a", parent_id: "root-1", title: "Child 1a", position: 0 }),
      mockPage({ id: "child-2a", parent_id: "root-2", title: "Child 2a", position: 0 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[1].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe("Child 1a");
    expect(tree[1].children[0].title).toBe("Child 2a");
  });
});
```

### Unit Tests: Tree Utility Functions

**File: `src/__tests__/hooks/usePageTree.test.ts`**

```typescript
import { describe, test, expect } from "vitest";
import { findPageInTree, getAncestryFromTree } from "@/hooks/usePageTree";
import type { PageTreeNode } from "@/types/page";

function mockTreeNode(overrides: Partial<PageTreeNode> = {}): PageTreeNode {
  return {
    id: "node-1",
    tenantId: "tenant-1",
    parentId: null,
    title: "Untitled",
    icon: null,
    coverUrl: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [],
    ...overrides,
  };
}

const sampleTree: PageTreeNode[] = [
  mockTreeNode({
    id: "root-1",
    title: "Root 1",
    children: [
      mockTreeNode({
        id: "child-1",
        parentId: "root-1",
        title: "Child 1",
        children: [
          mockTreeNode({
            id: "grandchild-1",
            parentId: "child-1",
            title: "Grandchild 1",
          }),
        ],
      }),
    ],
  }),
  mockTreeNode({ id: "root-2", title: "Root 2" }),
];

describe("findPageInTree", () => {
  test("finds a root-level page", () => {
    const result = findPageInTree(sampleTree, "root-1");
    expect(result?.title).toBe("Root 1");
  });

  test("finds a nested page", () => {
    const result = findPageInTree(sampleTree, "grandchild-1");
    expect(result?.title).toBe("Grandchild 1");
  });

  test("returns null for non-existent page", () => {
    const result = findPageInTree(sampleTree, "nonexistent");
    expect(result).toBeNull();
  });

  test("returns null for empty tree", () => {
    const result = findPageInTree([], "any-id");
    expect(result).toBeNull();
  });
});

describe("getAncestryFromTree", () => {
  test("returns path from root to deeply nested page", () => {
    const ancestry = getAncestryFromTree(sampleTree, "grandchild-1");
    expect(ancestry).toHaveLength(3);
    expect(ancestry[0].title).toBe("Root 1");
    expect(ancestry[1].title).toBe("Child 1");
    expect(ancestry[2].title).toBe("Grandchild 1");
  });

  test("returns single-item path for root page", () => {
    const ancestry = getAncestryFromTree(sampleTree, "root-2");
    expect(ancestry).toHaveLength(1);
    expect(ancestry[0].title).toBe("Root 2");
  });

  test("returns empty array for non-existent page", () => {
    const ancestry = getAncestryFromTree(sampleTree, "nonexistent");
    expect(ancestry).toEqual([]);
  });
});
```

### Integration Tests: Hierarchy Operations

**File: `src/__tests__/api/pages/hierarchy.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("Page Hierarchy API", () => {
  beforeEach(async () => {
    await prisma.page.deleteMany({ where: { tenant_id: TENANT_ID } });
  });

  afterEach(async () => {
    await prisma.page.deleteMany({ where: { tenant_id: TENANT_ID } });
  });

  test("POST /api/pages with parentId creates a child page", async () => {
    // Create parent
    const parentRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Parent" }),
    });
    const parent = (await parentRes.json()).data;

    // Create child
    const childRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Child", parentId: parent.id }),
    });
    const child = (await childRes.json()).data;

    expect(child.parentId).toBe(parent.id);
  });

  test("PUT /api/pages/[id] moves page to new parent", async () => {
    // Create two parents and one child
    const parent1Res = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Parent 1" }),
    });
    const parent1 = (await parent1Res.json()).data;

    const parent2Res = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Parent 2" }),
    });
    const parent2 = (await parent2Res.json()).data;

    const childRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Child", parentId: parent1.id }),
    });
    const child = (await childRes.json()).data;

    // Move child from parent1 to parent2
    const moveRes = await fetch(
      `http://localhost:3000/api/pages/${child.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: parent2.id }),
      }
    );
    const moved = (await moveRes.json()).data;

    expect(moved.parentId).toBe(parent2.id);
  });

  test("PUT /api/pages/[id] rejects circular reference", async () => {
    // Create parent → child hierarchy
    const parentRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Parent" }),
    });
    const parent = (await parentRes.json()).data;

    const childRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Child", parentId: parent.id }),
    });
    const child = (await childRes.json()).data;

    // Try to move parent under its own child (circular)
    const moveRes = await fetch(
      `http://localhost:3000/api/pages/${parent.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: child.id }),
      }
    );

    expect(moveRes.status).toBe(400);
    const body = await moveRes.json();
    expect(body.error.message).toContain("circular");
  });

  test("GET /api/pages/tree returns nested structure", async () => {
    // Create hierarchy: Root > Child > Grandchild
    const rootRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Root" }),
    });
    const root = (await rootRes.json()).data;

    const childRes = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Child", parentId: root.id }),
    });
    const child = (await childRes.json()).data;

    await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Grandchild", parentId: child.id }),
    });

    const treeRes = await fetch("http://localhost:3000/api/pages/tree", {
      headers: { Authorization: "Bearer test-tenant-a-key" },
    });

    expect(treeRes.status).toBe(200);
    const tree = (await treeRes.json()).data;
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe("Root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe("Child");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].title).toBe("Grandchild");
  });

  test("GET /api/pages?parentId=null returns only root pages", async () => {
    await prisma.page.createMany({
      data: [
        { tenant_id: TENANT_ID, title: "Root 1", position: 0 },
        { tenant_id: TENANT_ID, title: "Root 2", position: 1 },
      ],
    });
    const root1 = await prisma.page.findFirst({
      where: { tenant_id: TENANT_ID, title: "Root 1" },
    });
    await prisma.page.create({
      data: {
        tenant_id: TENANT_ID,
        title: "Child of Root 1",
        parent_id: root1!.id,
        position: 0,
      },
    });

    const response = await fetch(
      "http://localhost:3000/api/pages?parentId=null",
      {
        headers: { Authorization: "Bearer test-tenant-a-key" },
      }
    );

    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.data.every((p: { parentId: string | null }) => p.parentId === null)).toBe(true);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/pages/getPageTree.ts` |
| CREATE | `src/app/api/pages/tree/route.ts` |
| CREATE | `src/hooks/usePageTree.ts` |
| MODIFY | `src/app/api/pages/[id]/route.ts` (add circular reference detection to PUT) |
| MODIFY | `src/types/page.ts` (PageTreeNode type already included in SKB-03.1) |
| CREATE | `src/__tests__/lib/pages/getPageTree.test.ts` |
| CREATE | `src/__tests__/hooks/usePageTree.test.ts` |
| CREATE | `src/__tests__/api/pages/hierarchy.test.ts` |

---

**Last Updated:** 2026-02-21
