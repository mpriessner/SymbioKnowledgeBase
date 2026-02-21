import { describe, test, expect } from "vitest";
import { optimisticReorder } from "@/hooks/useReorderPage";
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

describe("optimisticReorder", () => {
  test("reorders within same parent (root level)", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
      mockTreeNode({ id: "b", title: "B", position: 1 }),
      mockTreeNode({ id: "c", title: "C", position: 2 }),
    ];

    // Move C to position 0
    const result = optimisticReorder(tree, "c", null, 0);

    expect(result[0].id).toBe("c");
    expect(result[1].id).toBe("a");
    expect(result[2].id).toBe("b");
    expect(result[0].position).toBe(0);
    expect(result[1].position).toBe(1);
    expect(result[2].position).toBe(2);
  });

  test("moves page to a different parent", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "parent-1",
        title: "Parent 1",
        position: 0,
        children: [
          mockTreeNode({
            id: "child-a",
            parentId: "parent-1",
            title: "Child A",
            position: 0,
          }),
        ],
      }),
      mockTreeNode({
        id: "parent-2",
        title: "Parent 2",
        position: 1,
        children: [],
      }),
    ];

    // Move child-a from parent-1 to parent-2
    const result = optimisticReorder(tree, "child-a", "parent-2", 0);

    expect(result[0].children).toHaveLength(0); // parent-1 has no children
    expect(result[1].children).toHaveLength(1); // parent-2 has child-a
    expect(result[1].children[0].id).toBe("child-a");
    expect(result[1].children[0].parentId).toBe("parent-2");
  });

  test("moves page to root level", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "parent",
        title: "Parent",
        position: 0,
        children: [
          mockTreeNode({
            id: "child",
            parentId: "parent",
            title: "Child",
            position: 0,
          }),
        ],
      }),
    ];

    // Move child to root level at position 0
    const result = optimisticReorder(tree, "child", null, 0);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("child");
    expect(result[0].parentId).toBeNull();
    expect(result[1].id).toBe("parent");
    expect(result[1].children).toHaveLength(0);
  });

  test("clamps position to valid range", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
      mockTreeNode({ id: "b", title: "B", position: 1 }),
    ];

    // Position 999 should clamp to end
    const result = optimisticReorder(tree, "a", null, 999);

    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
  });

  test("returns original tree when page not found", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
    ];

    const result = optimisticReorder(tree, "nonexistent", null, 0);

    expect(result).toEqual(tree);
  });

  test("does not mutate the original tree", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
      mockTreeNode({ id: "b", title: "B", position: 1 }),
    ];

    const originalFirstId = tree[0].id;
    optimisticReorder(tree, "b", null, 0);

    // Original tree should be unchanged
    expect(tree[0].id).toBe(originalFirstId);
    expect(tree).toHaveLength(2);
  });
});
