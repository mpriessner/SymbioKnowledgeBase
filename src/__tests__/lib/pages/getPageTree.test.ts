import { describe, test, expect } from "vitest";
import { buildPageTree } from "@/lib/pages/getPageTree";

// Helper to create a mock page row
function mockPage(
  overrides: Partial<{
    id: string;
    tenantId: string;
    parentId: string | null;
    title: string;
    icon: string | null;
    coverUrl: string | null;
    position: number;
    createdAt: Date;
    updatedAt: Date;
  }>
) {
  return {
    id: overrides.id ?? "page-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    parentId: overrides.parentId ?? null,
    title: overrides.title ?? "Untitled",
    icon: overrides.icon ?? null,
    coverUrl: overrides.coverUrl ?? null,
    position: overrides.position ?? 0,
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01"),
  };
}

describe("buildPageTree", () => {
  test("returns empty array for empty input", () => {
    const tree = buildPageTree([]);
    expect(tree).toEqual([]);
  });

  test("returns flat list as root nodes when all have null parentId", () => {
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
      mockPage({
        id: "child-1",
        parentId: "parent",
        title: "Child 1",
        position: 0,
      }),
      mockPage({
        id: "child-2",
        parentId: "parent",
        title: "Child 2",
        position: 1,
      }),
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
      mockPage({
        id: "l1",
        parentId: "root",
        title: "Level 1",
        position: 0,
      }),
      mockPage({ id: "l2", parentId: "l1", title: "Level 2", position: 0 }),
      mockPage({ id: "l3", parentId: "l2", title: "Level 3", position: 0 }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].children[0].title).toBe("Level 3");
  });

  test("sorts children by position at each level", () => {
    const pages = [
      mockPage({ id: "parent", title: "Parent", position: 0 }),
      mockPage({
        id: "child-b",
        parentId: "parent",
        title: "B",
        position: 2,
      }),
      mockPage({
        id: "child-a",
        parentId: "parent",
        title: "A",
        position: 0,
      }),
      mockPage({
        id: "child-c",
        parentId: "parent",
        title: "C",
        position: 1,
      }),
    ];

    const tree = buildPageTree(pages);
    expect(tree[0].children[0].title).toBe("A");
    expect(tree[0].children[1].title).toBe("C");
    expect(tree[0].children[2].title).toBe("B");
  });

  test("treats orphan pages (missing parent) as root nodes", () => {
    const pages = [
      mockPage({
        id: "orphan",
        parentId: "nonexistent",
        title: "Orphan",
        position: 0,
      }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe("Orphan");
  });

  test("handles multiple root pages with children", () => {
    const pages = [
      mockPage({ id: "root-1", title: "Root 1", position: 0 }),
      mockPage({ id: "root-2", title: "Root 2", position: 1 }),
      mockPage({
        id: "child-1a",
        parentId: "root-1",
        title: "Child 1a",
        position: 0,
      }),
      mockPage({
        id: "child-2a",
        parentId: "root-2",
        title: "Child 2a",
        position: 0,
      }),
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[1].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe("Child 1a");
    expect(tree[1].children[0].title).toBe("Child 2a");
  });
});
