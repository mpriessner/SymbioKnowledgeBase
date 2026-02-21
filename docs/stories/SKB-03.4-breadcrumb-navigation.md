# Story SKB-03.4: Breadcrumb Navigation

**Epic:** Epic 3 - Page Management & Navigation
**Story ID:** SKB-03.4
**Story Points:** 2 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-03.2 (page hierarchy needed to compute ancestry path)

---

## User Story

As a researcher, I want to see breadcrumbs showing the current page's location in the hierarchy, So that I always know where I am and can navigate to parent pages.

---

## Acceptance Criteria

- [ ] Breadcrumbs component displays the full ancestry path: Home > Parent Page > Current Page
- [ ] Each breadcrumb segment is clickable and navigates to that page via Next.js router
- [ ] "Home" is always the first breadcrumb and links to the workspace root (`/`)
- [ ] Ancestry is computed from the page tree data already fetched by the sidebar (no additional API call)
- [ ] For paths deeper than 4 levels, middle segments are truncated with "..." and expandable on click
- [ ] Breadcrumbs are placed in the workspace layout above the main content area
- [ ] Current page (last segment) is displayed as plain text (not clickable) with distinct styling
- [ ] Page icons are shown in breadcrumb segments when available
- [ ] Breadcrumbs update reactively when navigating between pages

---

## Architecture Overview

```
Breadcrumb Rendering:

Page Tree (from usePageTree):
Root
├── User Guide                 ← ancestry[0]
│   ├── Installation           ← ancestry[1]
│   │   └── Linux Setup        ← ancestry[2] (current page)

Rendered Breadcrumbs:
┌─────────────────────────────────────────────────────┐
│  🏠 Home  >  📖 User Guide  >  ⚙ Installation  >  Linux Setup  │
│  ↑ link      ↑ link            ↑ link              ↑ plain text  │
└─────────────────────────────────────────────────────┘

Truncation for Deep Nesting (5+ segments):
┌────────────────────────────────────────────────────────────────┐
│  🏠 Home  >  📖 User Guide  >  ...  >  Linux Setup  >  Ubuntu │
│  ↑ link      ↑ link           ↑ expand   ↑ link        ↑ text  │
└────────────────────────────────────────────────────────────────┘

Click "..." to expand:
┌────────────────────────────────────────────────────────────────────────┐
│  🏠 Home  >  📖 User Guide  >  ⚙ Installation  >  Linux Setup  >  Ubuntu │
└────────────────────────────────────────────────────────────────────────┘

Data Flow:

usePageTree() (already cached by Sidebar)
     │
     │  PageTreeNode[]
     ▼
getAncestryFromTree(tree, currentPageId)
     │
     │  { id, title, icon }[]
     ▼
Breadcrumbs.tsx ──▶ renders clickable segments

Layout Integration:

┌─────────────────────────────────────────────────────────┐
│  Sidebar │  ┌───────────────────────────────────────┐   │
│          │  │  Breadcrumbs                           │   │
│          │  ├───────────────────────────────────────┤   │
│          │  │                                        │   │
│          │  │  PageHeader + Content                  │   │
│          │  │                                        │   │
│          │  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the Breadcrumbs Component

The Breadcrumbs component takes the page tree and current page ID, computes the ancestry path, and renders clickable segments. It handles truncation for deeply nested pages.

**File: `src/components/workspace/Breadcrumbs.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getAncestryFromTree } from "@/hooks/usePageTree";
import type { PageTreeNode } from "@/types/page";

interface BreadcrumbsProps {
  tree: PageTreeNode[];
  currentPageId: string;
}

/** Maximum number of visible breadcrumb segments before truncation kicks in. */
const MAX_VISIBLE_SEGMENTS = 4;

export function Breadcrumbs({ tree, currentPageId }: BreadcrumbsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const ancestry = useMemo(
    () => getAncestryFromTree(tree, currentPageId),
    [tree, currentPageId]
  );

  // Reset expansion when navigating to a different page
  useMemo(() => {
    setIsExpanded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId]);

  if (ancestry.length === 0) {
    return null;
  }

  // Determine which segments to show
  let visibleSegments = ancestry;
  let showEllipsis = false;

  if (!isExpanded && ancestry.length > MAX_VISIBLE_SEGMENTS) {
    // Show: first segment, "...", last two segments
    const first = ancestry[0];
    const lastTwo = ancestry.slice(-2);
    visibleSegments = [first, ...lastTwo];
    showEllipsis = true;
  }

  const lastIndex = visibleSegments.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center px-16 py-2 max-w-4xl mx-auto">
      {/* Home breadcrumb */}
      <Link
        href="/"
        className="flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      </Link>

      <BreadcrumbSeparator />

      {visibleSegments.map((segment, index) => {
        const isLast = index === lastIndex;
        const isFirstAndNeedEllipsis = showEllipsis && index === 0;

        return (
          <span key={segment.id} className="flex items-center">
            {isLast ? (
              // Current page — plain text, not clickable
              <span className="text-sm text-gray-700 font-medium flex items-center gap-1">
                {segment.icon && <span className="text-xs">{segment.icon}</span>}
                <span className="truncate max-w-[200px]">{segment.title}</span>
              </span>
            ) : (
              // Ancestor page — clickable link
              <Link
                href={`/pages/${segment.id}`}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
              >
                {segment.icon && <span className="text-xs">{segment.icon}</span>}
                <span className="truncate max-w-[150px]">{segment.title}</span>
              </Link>
            )}

            {/* Separator after non-last items */}
            {!isLast && <BreadcrumbSeparator />}

            {/* Ellipsis after first segment when truncated */}
            {isFirstAndNeedEllipsis && (
              <>
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
                  aria-label="Show full breadcrumb path"
                  title="Show all ancestor pages"
                >
                  ...
                </button>
                <BreadcrumbSeparator />
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function BreadcrumbSeparator() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
```

---

### Step 2: Create a Breadcrumbs Wrapper with Data Fetching

This wrapper component reads the page tree from the TanStack Query cache (already fetched by the Sidebar) and passes it to the Breadcrumbs component along with the current page ID from the URL.

**File: `src/components/workspace/BreadcrumbsWrapper.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { usePageTree } from "@/hooks/usePageTree";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";

/**
 * Wrapper that extracts the current page ID from the URL
 * and passes the cached page tree to the Breadcrumbs component.
 *
 * This component reads from the same TanStack Query cache as the Sidebar,
 * so no additional API call is made.
 */
export function BreadcrumbsWrapper() {
  const pathname = usePathname();
  const { data } = usePageTree();

  // Extract page ID from pathname: /pages/[id]
  const pageIdMatch = pathname.match(/^\/pages\/([a-f0-9-]+)/);
  const currentPageId = pageIdMatch?.[1];

  // Only render breadcrumbs on page view routes
  if (!currentPageId || !data?.data) {
    return null;
  }

  return <Breadcrumbs tree={data.data} currentPageId={currentPageId} />;
}
```

---

### Step 3: Integrate Breadcrumbs into Workspace Layout

Update the workspace layout to include the BreadcrumbsWrapper above the main content area.

**Modifications to `src/app/(workspace)/layout.tsx`:**

```tsx
import { Sidebar } from "@/components/workspace/Sidebar";
import { BreadcrumbsWrapper } from "@/components/workspace/BreadcrumbsWrapper";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <BreadcrumbsWrapper />
        {children}
      </main>
    </div>
  );
}
```

---

## Testing Requirements

### Component Tests: Breadcrumbs

**File: `src/__tests__/components/workspace/Breadcrumbs.test.tsx`**

```tsx
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
        icon: "📖",
        children: [
          mockTreeNode({
            id: "child-1",
            parentId: "root-1",
            title: "Child",
            icon: "📝",
          }),
        ],
      }),
    ];

    render(<Breadcrumbs tree={tree} currentPageId="child-1" />);

    expect(screen.getByText("📖")).toBeInTheDocument();
    expect(screen.getByText("📝")).toBeInTheDocument();
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

    const homeLink = screen.getByRole("link", { name: "" }); // Home icon link has no text
    // Alternatively, find the first link
    const links = screen.getAllByRole("link");
    const homeHref = links[0].getAttribute("href");
    expect(homeHref).toBe("/");
  });
});
```

### E2E Test: Breadcrumb Navigation

**File: `tests/e2e/breadcrumbs.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Breadcrumb Navigation", () => {
  test("should display breadcrumbs on a page view", async ({ page }) => {
    await page.goto("http://localhost:3000");

    // Create a page
    await page.getByLabel("Create new page").click();
    await page.waitForURL(/\/pages\//);

    // Breadcrumb nav should be present
    await expect(page.getByLabel("Breadcrumb")).toBeVisible();
  });

  test("should navigate to parent via breadcrumb click", async ({ page }) => {
    await page.goto("http://localhost:3000");

    // Create parent page
    await page.getByLabel("Create new page").click();
    await page.waitForURL(/\/pages\//);
    const parentUrl = page.url();

    // Create child page via sidebar hover
    const parentNode = page.getByRole("treeitem").first();
    await parentNode.hover();
    await page.getByLabel(/Create page inside/).click();
    await page.waitForURL(/\/pages\//);

    // We should be on the child page now
    expect(page.url()).not.toBe(parentUrl);

    // Click the parent breadcrumb segment to go back
    const breadcrumb = page.getByLabel("Breadcrumb");
    const parentLink = breadcrumb.getByRole("link").last();
    await parentLink.click();

    // Should navigate to the parent page
    await expect(page).toHaveURL(parentUrl);
  });

  test("should show Home as first breadcrumb", async ({ page }) => {
    await page.goto("http://localhost:3000");

    // Create a page
    await page.getByLabel("Create new page").click();
    await page.waitForURL(/\/pages\//);

    // First link in breadcrumbs should be Home (/)
    const breadcrumb = page.getByLabel("Breadcrumb");
    const firstLink = breadcrumb.getByRole("link").first();
    await expect(firstLink).toHaveAttribute("href", "/");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/workspace/Breadcrumbs.tsx` |
| CREATE | `src/components/workspace/BreadcrumbsWrapper.tsx` |
| MODIFY | `src/app/(workspace)/layout.tsx` (add BreadcrumbsWrapper above children) |
| CREATE | `src/__tests__/components/workspace/Breadcrumbs.test.tsx` |
| CREATE | `tests/e2e/breadcrumbs.spec.ts` |

---

**Last Updated:** 2026-02-21
