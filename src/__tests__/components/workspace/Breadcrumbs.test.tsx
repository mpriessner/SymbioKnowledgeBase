import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import type { PageTreeNode } from "@/types/page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

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

describe("Breadcrumbs", () => {
  test("renders ancestry path for a root-level page", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "Root Page" }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="root-1" />);

    // Home icon should be present (via svg)
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
    // Current page should be plain text (not a link)
    expect(screen.getByText("Root Page")).toBeInTheDocument();
  });

  test("renders clickable ancestors for nested page", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "root-1",
        title: "Root",
        children: [
          mockTreeNode({
            id: "child-1",
            parentId: "root-1",
            title: "Child",
            children: [
              mockTreeNode({
                id: "grandchild-1",
                parentId: "child-1",
                title: "Grandchild",
              }),
            ],
          }),
        ],
      }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="grandchild-1" />);

    // Root and Child should be links
    const rootLink = screen.getByText("Root").closest("a");
    expect(rootLink).toHaveAttribute("href", "/pages/root-1");

    const childLink = screen.getByText("Child").closest("a");
    expect(childLink).toHaveAttribute("href", "/pages/child-1");

    // Grandchild should be plain text (no link)
    const grandchild = screen.getByText("Grandchild");
    expect(grandchild.closest("a")).toBeNull();
  });

  test("truncates breadcrumbs deeper than 4 levels with ellipsis", () => {
    // Build a 5-level deep tree
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "l1",
        title: "Level 1",
        children: [
          mockTreeNode({
            id: "l2",
            parentId: "l1",
            title: "Level 2",
            children: [
              mockTreeNode({
                id: "l3",
                parentId: "l2",
                title: "Level 3",
                children: [
                  mockTreeNode({
                    id: "l4",
                    parentId: "l3",
                    title: "Level 4",
                    children: [
                      mockTreeNode({
                        id: "l5",
                        parentId: "l4",
                        title: "Level 5",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="l5" />);

    // Should show Level 1, "...", Level 4, Level 5
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
    expect(screen.getByText("Level 4")).toBeInTheDocument();
    expect(screen.getByText("Level 5")).toBeInTheDocument();

    // Level 2 and Level 3 should be hidden
    expect(screen.queryByText("Level 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Level 3")).not.toBeInTheDocument();
  });

  test("expands truncated breadcrumbs when clicking ellipsis", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "l1",
        title: "Level 1",
        children: [
          mockTreeNode({
            id: "l2",
            parentId: "l1",
            title: "Level 2",
            children: [
              mockTreeNode({
                id: "l3",
                parentId: "l2",
                title: "Level 3",
                children: [
                  mockTreeNode({
                    id: "l4",
                    parentId: "l3",
                    title: "Level 4",
                    children: [
                      mockTreeNode({
                        id: "l5",
                        parentId: "l4",
                        title: "Level 5",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="l5" />);

    // Click the ellipsis
    fireEvent.click(screen.getByText("..."));

    // All levels should now be visible
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("Level 2")).toBeInTheDocument();
    expect(screen.getByText("Level 3")).toBeInTheDocument();
    expect(screen.getByText("Level 4")).toBeInTheDocument();
    expect(screen.getByText("Level 5")).toBeInTheDocument();
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });

  test("displays page icons in breadcrumb segments", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "root-1",
        title: "Root",
        icon: "\u{1F4D6}",
        children: [
          mockTreeNode({
            id: "child-1",
            parentId: "root-1",
            title: "Child",
            icon: "\u{1F4DD}",
          }),
        ],
      }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="child-1" />);

    expect(screen.getByText("\u{1F4D6}")).toBeInTheDocument();
    expect(screen.getByText("\u{1F4DD}")).toBeInTheDocument();
  });

  test("renders nothing when ancestry is empty (page not found in tree)", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "Root" }),
    ];

    const { container } = render(
      <Breadcrumbs tree={tree} currentPageId="nonexistent" />
    );

    // Should render nothing
    expect(container.querySelector("nav")).toBeNull();
  });

  test("Home link always points to root", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "Root" }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="root-1" />);

    const links = screen.getAllByRole("link");
    const homeHref = links[0].getAttribute("href");
    expect(homeHref).toBe("/");
  });
});
