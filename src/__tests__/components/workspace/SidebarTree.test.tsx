import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarTree } from "@/components/workspace/SidebarTree";
import type { PageTreeNode } from "@/types/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/pages/root-1",
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { value: localStorageMock });
  localStorageMock.clear();
});

describe("SidebarTree", () => {
  test("renders empty state when tree is empty", () => {
    render(<SidebarTree tree={[]} />, { wrapper: createWrapper() });
    expect(screen.getByText("No pages yet")).toBeInTheDocument();
  });

  test("renders root-level pages", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "Root 1" }),
      mockTreeNode({ id: "root-2", title: "Root 2" }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    expect(screen.getByText("Root 1")).toBeInTheDocument();
    expect(screen.getByText("Root 2")).toBeInTheDocument();
  });

  test("renders nested pages as children when expanded", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "root-1",
        title: "Root 1",
        children: [
          mockTreeNode({ id: "child-1", parentId: "root-1", title: "Child 1" }),
        ],
      }),
    ];

    // Set expand state in localStorage before rendering
    localStorageMock.setItem(
      "skb-sidebar-expanded",
      JSON.stringify({ "root-1": true })
    );

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    expect(screen.getByText("Root 1")).toBeInTheDocument();
    expect(screen.getByText("Child 1")).toBeInTheDocument();
  });

  test("highlights the active page based on pathname", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "Active Page" }),
      mockTreeNode({ id: "root-2", title: "Other Page" }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    // The active page (root-1 matching pathname /pages/root-1) should have active styling
    const activeItem = screen.getByText("Active Page").closest("[role='treeitem']");
    expect(activeItem).toHaveAttribute("aria-selected", "true");
  });

  test("renders page icon when present", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "With Icon", icon: "\u{1F4C4}" }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    expect(screen.getByText("\u{1F4C4}")).toBeInTheDocument();
  });

  test("renders chevron for nodes with children", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "root-1",
        title: "Has Children",
        children: [mockTreeNode({ id: "child-1", title: "Child" })],
      }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    const expandButton = screen.getByLabelText("Expand");
    expect(expandButton).toBeInTheDocument();
  });

  test("toggles expand/collapse on chevron click", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "root-1",
        title: "Parent",
        children: [mockTreeNode({ id: "child-1", title: "Child" })],
      }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });

    // Initially collapsed — child not visible
    expect(screen.queryByText("Child")).not.toBeInTheDocument();

    // Click expand
    fireEvent.click(screen.getByLabelText("Expand"));

    // Child should now be visible
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  test("has tree role and treeitem roles for accessibility", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "root-1", title: "Page 1" }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(screen.getByRole("treeitem")).toBeInTheDocument();
  });
});
