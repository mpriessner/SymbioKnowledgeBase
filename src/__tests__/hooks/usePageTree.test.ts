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
