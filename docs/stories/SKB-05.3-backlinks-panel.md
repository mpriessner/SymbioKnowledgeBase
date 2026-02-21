# Story SKB-05.3: Backlinks Panel and API

**Epic:** Epic 5 - Wikilinks & Backlinks
**Story ID:** SKB-05.3
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-05.1 (page_links table must be populated), SKB-03.1 (page API for fetching source page metadata)

---

## User Story

As a researcher, I want to see all pages linking to the current page, So that I can discover relationships and navigate my knowledge network.

---

## Acceptance Criteria

- [ ] `GET /api/pages/[id]/backlinks` endpoint queries `page_links WHERE target_page_id = id AND tenant_id`
- [ ] Endpoint joins `pages` table for title, icon of each linking (source) page
- [ ] Response format: `{ data: [{ pageId, pageTitle, pageIcon, snippet }], meta: { total } }`
- [ ] `BacklinksPanel.tsx`: collapsible panel below the editor showing list of linking pages
- [ ] Each backlink entry shows: page icon, page title (clickable, navigates to source page)
- [ ] Panel header shows count: "N backlinks" (e.g., "3 backlinks")
- [ ] Empty state: "No pages link to this page yet."
- [ ] Panel is collapsible (click header to toggle)
- [ ] Data fetched via TanStack Query with `useBacklinks` hook
- [ ] Cache invalidated when page_links change (after block saves)
- [ ] `GET /api/pages/[id]/links` endpoint for forward links (outgoing) — used by graph (Epic 7)
- [ ] Forward links response: `{ data: [{ pageId, pageTitle, pageIcon }], meta: { total } }`
- [ ] Both endpoints scoped by `tenant_id` via `withTenant()` wrapper
- [ ] Both endpoints return 404 if page not found within tenant
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Page View Layout
────────────────

  ┌──────────────────────────────────────────────────────┐
  │  Page Header (title, icon)                            │
  ├──────────────────────────────────────────────────────┤
  │                                                        │
  │  Block Editor (TipTap)                                │
  │  ...content...                                         │
  │                                                        │
  ├──────────────────────────────────────────────────────┤
  │                                                        │
  │  ▼ Backlinks (3)                    [click to toggle] │
  │  ┌────────────────────────────────────────────────┐   │
  │  │ 📄 Installation Guide                          │   │
  │  │ 📄 Getting Started                             │   │
  │  │ 📄 System Architecture                         │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  └──────────────────────────────────────────────────────┘

API Data Flow
─────────────

  BacklinksPanel.tsx
        │
        │ useBacklinks(pageId) → TanStack Query
        │
        ▼
  GET /api/pages/[id]/backlinks
        │
        │ 1. withTenant() — extract tenant_id from session
        │ 2. Validate page belongs to tenant
        │ 3. Query page_links + pages join
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  PostgreSQL                                            │
  │                                                        │
  │  SELECT p.id, p.title, p.icon                          │
  │  FROM page_links pl                                    │
  │  JOIN pages p ON p.id = pl.source_page_id              │
  │  WHERE pl.target_page_id = :pageId                     │
  │    AND pl.tenant_id = :tenantId                        │
  │  ORDER BY p.title ASC                                  │
  └──────────────────────────────────────────────────────┘
        │
        ▼
  Response: {
    data: [
      { pageId: 'uuid-1', pageTitle: 'Installation Guide', pageIcon: '📄' },
      { pageId: 'uuid-2', pageTitle: 'Getting Started', pageIcon: '📄' },
    ],
    meta: { total: 2 }
  }
```

---

## Implementation Steps

### Step 1: Create the Backlinks API Endpoint

**File: `src/app/api/pages/[id]/backlinks/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/withTenant';

interface BacklinkResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
}

/**
 * GET /api/pages/[id]/backlinks
 *
 * Returns all pages that link TO the specified page (incoming links / backlinks).
 * Queries the page_links table where target_page_id matches the given page ID,
 * then joins the pages table to get source page metadata.
 *
 * Response: { data: BacklinkResult[], meta: { total: number } }
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    { params, tenantId }: { params: { id: string }; tenantId: string }
  ) => {
    const pageId = params.id;

    // Verify the target page exists and belongs to this tenant
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        tenant_id: tenantId,
      },
      select: { id: true },
    });

    if (!page) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Page not found',
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 404 }
      );
    }

    // Query backlinks: pages that link TO this page
    const backlinks = await prisma.pageLink.findMany({
      where: {
        target_page_id: pageId,
        tenant_id: tenantId,
      },
      include: {
        source_page: {
          select: {
            id: true,
            title: true,
            icon: true,
          },
        },
      },
      orderBy: {
        source_page: {
          title: 'asc',
        },
      },
    });

    // Deduplicate by source page (in case of multiple links from same page)
    const seenPageIds = new Set<string>();
    const uniqueBacklinks: BacklinkResult[] = [];

    for (const link of backlinks) {
      if (!seenPageIds.has(link.source_page.id)) {
        seenPageIds.add(link.source_page.id);
        uniqueBacklinks.push({
          pageId: link.source_page.id,
          pageTitle: link.source_page.title,
          pageIcon: link.source_page.icon,
        });
      }
    }

    return NextResponse.json({
      data: uniqueBacklinks,
      meta: {
        total: uniqueBacklinks.length,
        timestamp: new Date().toISOString(),
      },
    });
  }
);
```

---

### Step 2: Create the Forward Links API Endpoint

**File: `src/app/api/pages/[id]/links/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/withTenant';

interface ForwardLinkResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
}

/**
 * GET /api/pages/[id]/links
 *
 * Returns all pages that the specified page links TO (outgoing / forward links).
 * Queries the page_links table where source_page_id matches the given page ID.
 *
 * Response: { data: ForwardLinkResult[], meta: { total: number } }
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    { params, tenantId }: { params: { id: string }; tenantId: string }
  ) => {
    const pageId = params.id;

    // Verify the source page exists and belongs to this tenant
    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        tenant_id: tenantId,
      },
      select: { id: true },
    });

    if (!page) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Page not found',
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 404 }
      );
    }

    // Query forward links: pages that this page links TO
    const forwardLinks = await prisma.pageLink.findMany({
      where: {
        source_page_id: pageId,
        tenant_id: tenantId,
      },
      include: {
        target_page: {
          select: {
            id: true,
            title: true,
            icon: true,
          },
        },
      },
      orderBy: {
        target_page: {
          title: 'asc',
        },
      },
    });

    const results: ForwardLinkResult[] = forwardLinks.map((link) => ({
      pageId: link.target_page.id,
      pageTitle: link.target_page.title,
      pageIcon: link.target_page.icon,
    }));

    return NextResponse.json({
      data: results,
      meta: {
        total: results.length,
        timestamp: new Date().toISOString(),
      },
    });
  }
);
```

---

### Step 3: Create the useBacklinks Hook

**File: `src/hooks/useBacklinks.ts`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

interface BacklinkResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
}

interface BacklinksResponse {
  data: BacklinkResult[];
  meta: {
    total: number;
    timestamp: string;
  };
}

/**
 * TanStack Query hook for fetching backlinks for a page.
 *
 * @param pageId - The page ID to fetch backlinks for
 * @param options.enabled - Whether the query should run
 */
export function useBacklinks(
  pageId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<BacklinksResponse>({
    queryKey: ['pages', pageId, 'backlinks'],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/backlinks`);

      if (!response.ok) {
        throw new Error('Failed to fetch backlinks');
      }

      return response.json() as Promise<BacklinksResponse>;
    },
    enabled: enabled && pageId !== null,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * TanStack Query hook for fetching forward links for a page.
 *
 * @param pageId - The page ID to fetch forward links for
 */
export function useForwardLinks(
  pageId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<BacklinksResponse>({
    queryKey: ['pages', pageId, 'links'],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/links`);

      if (!response.ok) {
        throw new Error('Failed to fetch forward links');
      }

      return response.json() as Promise<BacklinksResponse>;
    },
    enabled: enabled && pageId !== null,
    staleTime: 30_000,
  });
}
```

---

### Step 4: Create the BacklinksPanel Component

**File: `src/components/page/BacklinksPanel.tsx`**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBacklinks } from '@/hooks/useBacklinks';

interface BacklinksPanelProps {
  /** The page ID to show backlinks for */
  pageId: string;
}

/**
 * Collapsible panel showing all pages that link to the current page.
 *
 * Rendered below the block editor on each page view.
 * Shows a count in the header ("3 backlinks") and a list of
 * linking pages with icons and titles. Clicking a backlink
 * navigates to the source page.
 */
export function BacklinksPanel({ pageId }: BacklinksPanelProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const { data, isLoading, error } = useBacklinks(pageId);

  const backlinks = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const navigateToPage = useCallback(
    (targetPageId: string) => {
      router.push(`/pages/${targetPageId}`);
    },
    [router]
  );

  if (error) {
    return null; // Silently fail — backlinks are supplementary
  }

  return (
    <div className="mt-8 border-t border-[var(--color-border)] pt-4">
      {/* Header — click to toggle */}
      <button
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 text-left text-sm font-medium
                   text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                   transition-colors duration-150"
        aria-expanded={isExpanded}
        aria-controls="backlinks-list"
      >
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>
          {isLoading
            ? 'Loading backlinks...'
            : `${total} ${total === 1 ? 'backlink' : 'backlinks'}`}
        </span>
      </button>

      {/* Backlinks list */}
      {isExpanded && (
        <div id="backlinks-list" className="mt-3 space-y-1" role="list">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded bg-[var(--color-bg-secondary)]"
                />
              ))}
            </div>
          )}

          {!isLoading && backlinks.length === 0 && (
            <p className="py-2 text-sm text-[var(--color-text-secondary)]">
              No pages link to this page yet.
            </p>
          )}

          {!isLoading &&
            backlinks.map((backlink) => (
              <button
                key={backlink.pageId}
                role="listitem"
                onClick={() => navigateToPage(backlink.pageId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm
                           text-[var(--color-text-primary)]
                           hover:bg-[var(--color-bg-secondary)]
                           transition-colors duration-100 cursor-pointer text-left"
              >
                <span className="flex-shrink-0 text-base">
                  {backlink.pageIcon || '\u{1F4C4}'}
                </span>
                <span className="truncate">{backlink.pageTitle}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 5: Integrate BacklinksPanel into Page View

**File: `src/app/(workspace)/pages/[id]/page.tsx` (modification)**

Add the BacklinksPanel below the editor:

```typescript
import { BacklinksPanel } from '@/components/page/BacklinksPanel';

// Inside the page component, after the BlockEditor:
export default function PageView({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Page header */}
      {/* ... */}

      {/* Block editor */}
      {/* ... */}

      {/* Backlinks panel */}
      <BacklinksPanel pageId={params.id} />
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/page/BacklinksPanel.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacklinksPanel } from '@/components/page/BacklinksPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useBacklinks
vi.mock('@/hooks/useBacklinks', () => ({
  useBacklinks: vi.fn(),
}));

import { useBacklinks } from '@/hooks/useBacklinks';
const mockUseBacklinks = vi.mocked(useBacklinks);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('BacklinksPanel', () => {
  it('should render backlink count in header', () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [
          { pageId: 'id-1', pageTitle: 'Page A', pageIcon: null },
          { pageId: 'id-2', pageTitle: 'Page B', pageIcon: null },
        ],
        meta: { total: 2, timestamp: '' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);
    expect(screen.getByText('2 backlinks')).toBeInTheDocument();
  });

  it('should render singular "backlink" for count of 1', () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [{ pageId: 'id-1', pageTitle: 'Page A', pageIcon: null }],
        meta: { total: 1, timestamp: '' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);
    expect(screen.getByText('1 backlink')).toBeInTheDocument();
  });

  it('should render backlink entries with titles', () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [
          { pageId: 'id-1', pageTitle: 'Installation Guide', pageIcon: null },
          { pageId: 'id-2', pageTitle: 'Getting Started', pageIcon: null },
        ],
        meta: { total: 2, timestamp: '' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);
    expect(screen.getByText('Installation Guide')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });

  it('should show empty state when no backlinks', () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [],
        meta: { total: 0, timestamp: '' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);
    expect(screen.getByText('No pages link to this page yet.')).toBeInTheDocument();
  });

  it('should navigate to source page on click', () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [{ pageId: 'id-1', pageTitle: 'Page A', pageIcon: null }],
        meta: { total: 1, timestamp: '' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);
    fireEvent.click(screen.getByText('Page A'));
    expect(mockPush).toHaveBeenCalledWith('/pages/id-1');
  });

  it('should toggle collapsed/expanded on header click', () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [{ pageId: 'id-1', pageTitle: 'Page A', pageIcon: null }],
        meta: { total: 1, timestamp: '' },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);

    // Initially expanded
    expect(screen.getByText('Page A')).toBeVisible();

    // Click header to collapse
    fireEvent.click(screen.getByText('1 backlink'));
    expect(screen.queryByText('Page A')).not.toBeInTheDocument();

    // Click header to expand
    fireEvent.click(screen.getByText('1 backlink'));
    expect(screen.getByText('Page A')).toBeVisible();
  });

  it('should show loading state', () => {
    mockUseBacklinks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    renderWithProviders(<BacklinksPanel pageId="test-page" />);
    expect(screen.getByText('Loading backlinks...')).toBeInTheDocument();
  });
});
```

### Integration Tests: `src/__tests__/api/pages/backlinks.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('GET /api/pages/[id]/backlinks (integration)', () => {
  let tenantId: string;
  let pageAId: string;
  let pageBId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test' } });
    tenantId = tenant.id;

    const pageA = await prisma.page.create({
      data: { title: 'Page A', tenant_id: tenantId },
    });
    pageAId = pageA.id;

    const pageB = await prisma.page.create({
      data: { title: 'Page B', tenant_id: tenantId },
    });
    pageBId = pageB.id;

    // Page A links to Page B
    await prisma.pageLink.create({
      data: {
        source_page_id: pageAId,
        target_page_id: pageBId,
        tenant_id: tenantId,
      },
    });
  });

  it('should return backlinks for a page', async () => {
    const response = await fetch(`/api/pages/${pageBId}/backlinks`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pageId).toBe(pageAId);
    expect(body.data[0].pageTitle).toBe('Page A');
    expect(body.meta.total).toBe(1);
  });

  it('should return empty array for page with no backlinks', async () => {
    const response = await fetch(`/api/pages/${pageAId}/backlinks`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it('should return 404 for non-existent page', async () => {
    const response = await fetch(`/api/pages/nonexistent-id/backlinks`);
    expect(response.status).toBe(404);
  });

  it('should enforce tenant isolation', async () => {
    // Create a page in a different tenant
    const otherTenant = await prisma.tenant.create({ data: { name: 'Other' } });
    const otherPage = await prisma.page.create({
      data: { title: 'Other Page', tenant_id: otherTenant.id },
    });

    // Should not find it from the first tenant's perspective
    const response = await fetch(`/api/pages/${otherPage.id}/backlinks`);
    expect(response.status).toBe(404);
  });
});
```

### E2E Test: `tests/e2e/backlinks.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Backlinks Panel', () => {
  test('should show backlinks count and entries', async ({ page }) => {
    // Navigate to a page that has backlinks
    await page.goto('/pages/target-page-id');

    // Backlinks panel should be visible
    const panel = page.locator('text=/\\d+ backlinks?/');
    await expect(panel).toBeVisible();
  });

  test('should navigate to source page on backlink click', async ({ page }) => {
    await page.goto('/pages/target-page-id');

    // Click the first backlink entry
    const backlinkEntry = page
      .locator('[role="listitem"]')
      .first();

    if (await backlinkEntry.isVisible()) {
      const title = await backlinkEntry.textContent();
      await backlinkEntry.click();

      // Should navigate to the source page
      await expect(page).toHaveURL(/\/pages\//);
    }
  });

  test('should toggle panel collapsed/expanded', async ({ page }) => {
    await page.goto('/pages/target-page-id');

    const header = page.locator('text=/\\d+ backlinks?/');
    const list = page.locator('#backlinks-list');

    // Initially expanded
    await expect(list).toBeVisible();

    // Click to collapse
    await header.click();
    await expect(list).not.toBeVisible();

    // Click to expand
    await header.click();
    await expect(list).toBeVisible();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/app/api/pages/[id]/backlinks/route.ts` |
| CREATE | `src/app/api/pages/[id]/links/route.ts` |
| CREATE | `src/hooks/useBacklinks.ts` |
| CREATE | `src/components/page/BacklinksPanel.tsx` |
| MODIFY | `src/app/(workspace)/pages/[id]/page.tsx` (add BacklinksPanel below editor) |
| CREATE | `src/__tests__/components/page/BacklinksPanel.test.tsx` |
| CREATE | `src/__tests__/api/pages/backlinks.test.ts` |
| CREATE | `tests/e2e/backlinks.spec.ts` |

---

**Last Updated:** 2026-02-21
