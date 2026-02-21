# Story SKB-03.3: Sidebar Page Tree

**Epic:** Epic 3 - Page Management & Navigation
**Story ID:** SKB-03.3
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-03.2 (page hierarchy support needed for tree rendering)

---

## User Story

As a researcher, I want to see all my pages in a tree sidebar, So that I can navigate my knowledge base structure at a glance.

---

## Acceptance Criteria

- [ ] Sidebar component renders at the left side of the workspace layout, fetching the page tree via TanStack Query (`usePageTree`)
- [ ] `SidebarTree` recursively renders tree nodes with expand/collapse chevron icons for pages that have children
- [ ] The currently active page (matching URL) is visually highlighted in the sidebar
- [ ] "New Page" button at the top of the sidebar creates a new root-level page
- [ ] Hovering over a tree node reveals a "+" button that creates a child page under that node
- [ ] Clicking a page name navigates to `/pages/[id]` using Next.js router
- [ ] Expand/collapse state is persisted in `localStorage` and restored on page reload
- [ ] Sidebar is collapsible via a toggle button (collapsed state shows only icons or a narrow strip)
- [ ] Loading skeleton is shown while the page tree is being fetched
- [ ] Empty state is shown when no pages exist (with prompt to create first page)

---

## Architecture Overview

```
Workspace Layout
┌──────────────────┬────────────────────────────────────────┐
│                  │                                         │
│  Sidebar         │  Main Content Area                      │
│  ┌────────────┐  │  ┌──────────────────────────────────┐  │
│  │ [Toggle] ◀ │  │  │  Breadcrumbs (SKB-03.4)          │  │
│  │            │  │  │  PageHeader + Editor               │  │
│  │ [+ New Page│  │  │                                    │  │
│  │            │  │  │                                    │  │
│  │ ▼ 📄 Root 1│  │  │                                    │  │
│  │   📄 Child │  │  │                                    │  │
│  │   📄 Child │  │  │                                    │  │
│  │ ▶ 📄 Root 2│  │  │                                    │  │
│  │ 📄 Root 3  │  │  │                                    │  │
│  │            │  │  │                                    │  │
│  └────────────┘  │  └──────────────────────────────────┘  │
│                  │                                         │
└──────────────────┴────────────────────────────────────────┘

Component Hierarchy:

Sidebar.tsx
├── SidebarHeader (toggle button, "New Page" button)
├── SidebarTree.tsx (recursive tree renderer)
│   ├── SidebarTreeNode (page item)
│   │   ├── ChevronIcon (expand/collapse for nodes with children)
│   │   ├── PageIcon (emoji or default icon)
│   │   ├── PageTitle (clickable link)
│   │   ├── NewChildButton (appears on hover)
│   │   └── SidebarTree (recursive children)
│   └── ...
└── SidebarFooter (optional)

Data Flow:

usePageTree() ─── GET /api/pages/tree ──▶ PostgreSQL
     │
     │  PageTreeNode[]
     ▼
SidebarTree ──── renders recursively ──▶ SidebarTreeNode[]
     │
     │  onClick
     ▼
router.push(`/pages/${id}`)

Expand/Collapse State:

localStorage key: "skb-sidebar-expanded"
value: JSON.stringify({ "page-id-1": true, "page-id-2": false })
     │
     ▼
useExpandState() hook
├── reads on mount
├── toggles on chevron click
└── writes to localStorage on change
```

---

## Implementation Steps

### Step 1: Create the Expand State Hook

This hook manages the expand/collapse state of sidebar tree nodes, persisting to `localStorage` so the state survives page reloads.

**File: `src/hooks/useSidebarExpandState.ts`**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "skb-sidebar-expanded";

type ExpandState = Record<string, boolean>;

/**
 * Manages expand/collapse state for sidebar tree nodes.
 * State is persisted to localStorage so it survives page reloads.
 */
export function useSidebarExpandState() {
  const [expandState, setExpandState] = useState<ExpandState>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setExpandState(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors, start with empty state
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expandState));
      } catch {
        // Ignore storage errors (quota exceeded, etc.)
      }
    }
  }, [expandState, isHydrated]);

  const isExpanded = useCallback(
    (pageId: string): boolean => {
      return expandState[pageId] ?? false;
    },
    [expandState]
  );

  const toggle = useCallback((pageId: string) => {
    setExpandState((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  }, []);

  const expand = useCallback((pageId: string) => {
    setExpandState((prev) => ({
      ...prev,
      [pageId]: true,
    }));
  }, []);

  const collapse = useCallback((pageId: string) => {
    setExpandState((prev) => ({
      ...prev,
      [pageId]: false,
    }));
  }, []);

  return { isExpanded, toggle, expand, collapse, isHydrated };
}
```

---

### Step 2: Create the Sidebar Collapse State Hook

**File: `src/hooks/useSidebarCollapse.ts`**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "skb-sidebar-collapsed";

/**
 * Manages the collapsed/expanded state of the entire sidebar.
 */
export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  return { isCollapsed, toggle };
}
```

---

### Step 3: Create the SidebarTreeNode Component

This is the individual tree node component. It renders the page icon, title, expand/collapse chevron, and a hover-visible "create child" button.

**File: `src/components/workspace/SidebarTreeNode.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCreatePage } from "@/hooks/usePages";
import type { PageTreeNode } from "@/types/page";

interface SidebarTreeNodeProps {
  node: PageTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (pageId: string) => void;
  expandState: {
    isExpanded: (pageId: string) => boolean;
    toggle: (pageId: string) => void;
  };
}

export function SidebarTreeNode({
  node,
  depth,
  isExpanded,
  onToggle,
  expandState,
}: SidebarTreeNodeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const createPage = useCreatePage();
  const [isHovered, setIsHovered] = useState(false);

  const isActive = pathname === `/pages/${node.id}`;
  const hasChildren = node.children.length > 0;
  const paddingLeft = 12 + depth * 16;

  const handleClick = useCallback(() => {
    router.push(`/pages/${node.id}`);
  }, [router, node.id]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [onToggle, node.id]
  );

  const handleCreateChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      createPage.mutate(
        { title: "Untitled", parentId: node.id },
        {
          onSuccess: (data) => {
            // Expand this node to show the new child
            if (!isExpanded) {
              onToggle(node.id);
            }
            router.push(`/pages/${data.data.id}`);
          },
        }
      );
    },
    [createPage, node.id, isExpanded, onToggle, router]
  );

  return (
    <div>
      {/* Node row */}
      <div
        className={`
          group flex items-center h-8 cursor-pointer rounded-md mx-1
          transition-colors duration-100
          ${isActive ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100 text-gray-700"}
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isActive}
        aria-level={depth + 1}
      >
        {/* Expand/collapse chevron */}
        <button
          className={`
            flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
            transition-colors hover:bg-gray-200
            ${!hasChildren ? "invisible" : ""}
          `}
          onClick={handleToggle}
          tabIndex={-1}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Page icon */}
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-sm mr-1">
          {node.icon || (
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          )}
        </span>

        {/* Page title */}
        <span className="flex-1 truncate text-sm leading-none">{node.title}</span>

        {/* Create child button (visible on hover) */}
        {isHovered && (
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 mr-1"
            onClick={handleCreateChild}
            aria-label={`Create page inside ${node.title}`}
            title="Create subpage"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>

      {/* Recursive children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandState.isExpanded(child.id)}
              onToggle={expandState.toggle}
              expandState={expandState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 4: Create the SidebarTree Component

This is the top-level tree renderer that maps over root nodes and renders `SidebarTreeNode` for each.

**File: `src/components/workspace/SidebarTree.tsx`**

```tsx
"use client";

import { SidebarTreeNode } from "@/components/workspace/SidebarTreeNode";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import type { PageTreeNode } from "@/types/page";

interface SidebarTreeProps {
  tree: PageTreeNode[];
}

export function SidebarTree({ tree }: SidebarTreeProps) {
  const expandState = useSidebarExpandState();

  if (!expandState.isHydrated) {
    return null; // Avoid flash of incorrect expand state during SSR hydration
  }

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gray-400 mb-2">No pages yet</p>
        <p className="text-xs text-gray-300">
          Click "New Page" above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="py-1" role="tree" aria-label="Page tree">
      {tree.map((node) => (
        <SidebarTreeNode
          key={node.id}
          node={node}
          depth={0}
          isExpanded={expandState.isExpanded(node.id)}
          onToggle={expandState.toggle}
          expandState={expandState}
        />
      ))}
    </div>
  );
}
```

---

### Step 5: Create the Sidebar Component

The main Sidebar component that contains the header (toggle, new page button), the tree, and handles the collapsed/expanded state of the entire sidebar.

**File: `src/components/workspace/Sidebar.tsx`**

```tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarTree } from "@/components/workspace/SidebarTree";
import { usePageTree } from "@/hooks/usePageTree";
import { useCreatePage } from "@/hooks/usePages";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";

export function Sidebar() {
  const router = useRouter();
  const { data, isLoading, error } = usePageTree();
  const createPage = useCreatePage();
  const { isCollapsed, toggle: toggleSidebar } = useSidebarCollapse();

  const handleNewPage = useCallback(() => {
    createPage.mutate(
      { title: "Untitled" },
      {
        onSuccess: (data) => {
          router.push(`/pages/${data.data.id}`);
        },
      }
    );
  }, [createPage, router]);

  // Collapsed sidebar: narrow strip with toggle button
  if (isCollapsed) {
    return (
      <aside className="w-10 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-2">
        <button
          onClick={toggleSidebar}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col h-full overflow-hidden">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700 truncate">
          Pages
        </span>
        <div className="flex items-center gap-1">
          {/* New Page button */}
          <button
            onClick={handleNewPage}
            disabled={createPage.isPending}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
            aria-label="Create new page"
            title="New page"
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Collapse sidebar button */}
          <button
            onClick={toggleSidebar}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-3 py-4 space-y-2">
            {/* Loading skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <div
                  className="h-3 bg-gray-200 rounded"
                  style={{ width: `${60 + Math.random() * 80}px` }}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-3 py-4">
            <p className="text-sm text-red-500">Failed to load pages</p>
            <p className="text-xs text-red-400 mt-1">{error.message}</p>
          </div>
        )}

        {data && <SidebarTree tree={data.data} />}
      </div>
    </aside>
  );
}
```

---

### Step 6: Integrate Sidebar into Workspace Layout

Update the workspace layout to include the Sidebar component. This replaces the sidebar placeholder created in SKB-01.4.

**Modifications to `src/app/(workspace)/layout.tsx`:**

```tsx
import { Sidebar } from "@/components/workspace/Sidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

**Why this layout pattern:**
- `flex h-screen overflow-hidden` creates a full-viewport container with no body scroll
- The sidebar has a fixed width (`w-64`) and internal scroll for long page trees
- The main area gets `flex-1` to fill remaining width, with its own scroll context
- This is the standard Notion/Obsidian layout pattern: fixed sidebar + scrollable main content

---

## Testing Requirements

### Component Tests: SidebarTree

**File: `src/__tests__/components/workspace/SidebarTree.test.tsx`**

```tsx
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
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
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

  test("renders nested pages as children", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "root-1",
        title: "Root 1",
        children: [
          mockTreeNode({ id: "child-1", parentId: "root-1", title: "Child 1" }),
        ],
      }),
    ];

    // First, expand the root node via localStorage
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
      mockTreeNode({ id: "root-1", title: "With Icon", icon: "📄" }),
    ];

    render(<SidebarTree tree={tree} />, { wrapper: createWrapper() });
    expect(screen.getByText("📄")).toBeInTheDocument();
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
```

### Component Tests: Sidebar

**File: `src/__tests__/components/workspace/Sidebar.test.tsx`**

```tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/workspace/Sidebar";

// Mock the hooks
vi.mock("@/hooks/usePageTree", () => ({
  usePageTree: () => ({
    data: {
      data: [
        {
          id: "page-1",
          tenantId: "t1",
          parentId: null,
          title: "Test Page",
          icon: null,
          coverUrl: null,
          position: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          children: [],
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/pages/page-1",
}));

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Sidebar", () => {
  test("renders the sidebar with 'Pages' header", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Pages")).toBeInTheDocument();
  });

  test("renders 'New page' button", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Create new page")).toBeInTheDocument();
  });

  test("renders 'Collapse sidebar' button", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });

  test("collapses sidebar when toggle button is clicked", () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    // After collapsing, should show "Expand sidebar" button
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    // "Pages" header should no longer be visible
    expect(screen.queryByText("Pages")).not.toBeInTheDocument();
  });

  test("renders page tree data", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Test Page")).toBeInTheDocument();
  });
});
```

### E2E Test: Sidebar Navigation

**File: `tests/e2e/sidebar.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Sidebar Page Tree", () => {
  test.beforeEach(async ({ page }) => {
    // Log in and navigate to workspace
    // (assumes auth is set up from Epic 2 tests)
    await page.goto("http://localhost:3000");
  });

  test("should display the sidebar with page tree", async ({ page }) => {
    await expect(page.getByText("Pages")).toBeVisible();
  });

  test("should create a new page via sidebar button", async ({ page }) => {
    await page.getByLabel("Create new page").click();

    // Should navigate to the new page
    await expect(page).toHaveURL(/\/pages\/[a-f0-9-]+/);
    await expect(page.getByText("Untitled")).toBeVisible();
  });

  test("should navigate to a page by clicking in sidebar", async ({ page }) => {
    // Create a page first
    await page.getByLabel("Create new page").click();
    await page.waitForURL(/\/pages\//);

    // Click the page in sidebar
    const sidebarPage = page.getByRole("treeitem").first();
    await sidebarPage.click();

    await expect(page).toHaveURL(/\/pages\/[a-f0-9-]+/);
  });

  test("should expand and collapse tree nodes", async ({ page }) => {
    // Create parent page
    await page.getByLabel("Create new page").click();
    await page.waitForURL(/\/pages\//);

    // Create child page via hover button
    const parentNode = page.getByRole("treeitem").first();
    await parentNode.hover();
    await page.getByLabel(/Create page inside/).click();

    // Child should be visible (parent auto-expanded)
    await expect(page.getByRole("treeitem")).toHaveCount(2);

    // Collapse parent
    await page.getByLabel("Collapse").click();

    // Child should be hidden
    await expect(page.getByRole("treeitem")).toHaveCount(1);
  });

  test("should collapse and expand the entire sidebar", async ({ page }) => {
    await expect(page.getByText("Pages")).toBeVisible();

    // Collapse sidebar
    await page.getByLabel("Collapse sidebar").click();
    await expect(page.getByText("Pages")).not.toBeVisible();

    // Expand sidebar
    await page.getByLabel("Expand sidebar").click();
    await expect(page.getByText("Pages")).toBeVisible();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/hooks/useSidebarExpandState.ts` |
| CREATE | `src/hooks/useSidebarCollapse.ts` |
| CREATE | `src/components/workspace/SidebarTreeNode.tsx` |
| CREATE | `src/components/workspace/SidebarTree.tsx` |
| CREATE | `src/components/workspace/Sidebar.tsx` |
| MODIFY | `src/app/(workspace)/layout.tsx` (integrate Sidebar component) |
| CREATE | `src/__tests__/components/workspace/SidebarTree.test.tsx` |
| CREATE | `src/__tests__/components/workspace/Sidebar.test.tsx` |
| CREATE | `tests/e2e/sidebar.spec.ts` |

---

**Last Updated:** 2026-02-21
