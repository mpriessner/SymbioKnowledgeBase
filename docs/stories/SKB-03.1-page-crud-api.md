# Story SKB-03.1: Page CRUD API and Basic Page View

**Epic:** Epic 3 - Page Management & Navigation
**Story ID:** SKB-03.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-02.2 (tenant isolation middleware must be functional)

---

## User Story

As a researcher (or AI agent), I want to create, read, update, and delete pages, So that I can build my knowledge base with organized content.

---

## Acceptance Criteria

- [ ] `POST /api/pages` creates a new page with `title`, optional `parentId`, `icon`, `coverUrl`; returns the created page with `id`
- [ ] `GET /api/pages` returns a paginated list of pages with `?limit=20&offset=0`, sorting with `?sortBy=updatedAt&order=desc`, and filtering with `?parentId=null` for root pages
- [ ] `GET /api/pages/[id]` returns a single page with full metadata (id, title, icon, coverUrl, parentId, position, createdAt, updatedAt)
- [ ] `PUT /api/pages/[id]` updates page fields (title, icon, coverUrl, parentId); returns the updated page
- [ ] `DELETE /api/pages/[id]` hard-deletes the page and returns 204 No Content
- [ ] All endpoints are wrapped with `withTenant()` and scope all queries by `tenant_id`
- [ ] All inputs are validated with Zod schemas; invalid input returns 400 with descriptive error message
- [ ] Page title has a maximum length of 500 characters and defaults to `'Untitled'` when not provided
- [ ] `src/lib/validation/pages.ts` contains Zod schemas for create and update payloads
- [ ] Basic page view at `(workspace)/pages/[id]/page.tsx` fetches page data and displays title with editor placeholder
- [ ] `PageHeader` component displays editable title, icon, and cover image area
- [ ] API responses follow the standard envelope: `successResponse(data)` for single items, `listResponse(data, total, limit, offset)` for lists, `errorResponse(code, message)` for errors

---

## Architecture Overview

```
Browser / AI Agent
    │
    │  HTTP Request
    ▼
┌──────────────────────────────────────────────────────────┐
│  Next.js API Routes                                       │
│                                                           │
│  src/app/api/pages/route.ts                               │
│  ├── GET  /api/pages         → List pages (paginated)     │
│  └── POST /api/pages         → Create page                │
│                                                           │
│  src/app/api/pages/[id]/route.ts                          │
│  ├── GET    /api/pages/:id   → Get single page            │
│  ├── PUT    /api/pages/:id   → Update page                │
│  └── DELETE /api/pages/:id   → Delete page                │
│                                                           │
│  All wrapped with withTenant() ──▶ TenantContext injected  │
│  All inputs validated with Zod ──▶ 400 on invalid input   │
└──────────────────────┬────────────────────────────────────┘
                       │
                       │  Prisma Client (tenant-scoped)
                       ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL 18 — pages table                              │
│                                                           │
│  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()    │
│  tenant_id   UUID NOT NULL → tenants(id)                  │
│  parent_id   UUID → pages(id) (self-reference, nullable)  │
│  title       VARCHAR(500) NOT NULL DEFAULT 'Untitled'     │
│  icon        VARCHAR(50) (emoji)                          │
│  cover_url   TEXT (image URL)                             │
│  position    INTEGER NOT NULL DEFAULT 0                   │
│  created_at  TIMESTAMPTZ DEFAULT now()                    │
│  updated_at  TIMESTAMPTZ DEFAULT now()                    │
│                                                           │
│  INDEX: (tenant_id, parent_id, position)                  │
└──────────────────────────────────────────────────────────┘

Page View Component Flow:

┌─────────────────────────────────────────┐
│  (workspace)/pages/[id]/page.tsx        │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  PageHeader                     │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │ Cover Image Area          │  │    │
│  │  │ (full-width banner)       │  │    │
│  │  ├───────────────────────────┤  │    │
│  │  │ 📄 Icon  │  Page Title    │  │    │
│  │  │ (click)  │  (editable h1) │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Editor Placeholder             │    │
│  │  "Start writing or press /..."  │    │
│  │  (Epic 4 provides real editor)  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Page TypeScript Types

Define the TypeScript types used across all page-related code. These types are the source of truth for the shape of page data throughout the application.

**File: `src/types/page.ts`**

```typescript
export interface Page {
  id: string;
  tenantId: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageTreeNode extends Page {
  children: PageTreeNode[];
}

export interface CreatePageInput {
  title?: string;
  parentId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
}

export interface UpdatePageInput {
  title?: string;
  parentId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
}
```

---

### Step 2: Create Zod Validation Schemas

Define Zod schemas for validating API request bodies and query parameters. These schemas enforce input constraints and provide descriptive error messages.

**File: `src/lib/validation/pages.ts`**

```typescript
import { z } from "zod";

export const createPageSchema = z.object({
  title: z
    .string()
    .max(500, "Title must be 500 characters or fewer")
    .optional()
    .default("Untitled"),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable()
    .optional()
    .default(null),
  icon: z
    .string()
    .max(50, "Icon must be 50 characters or fewer")
    .nullable()
    .optional()
    .default(null),
  coverUrl: z
    .string()
    .url("coverUrl must be a valid URL")
    .nullable()
    .optional()
    .default(null),
});

export const updatePageSchema = z.object({
  title: z
    .string()
    .max(500, "Title must be 500 characters or fewer")
    .optional(),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable()
    .optional(),
  icon: z
    .string()
    .max(50, "Icon must be 50 characters or fewer")
    .nullable()
    .optional(),
  coverUrl: z
    .string()
    .url("coverUrl must be a valid URL")
    .nullable()
    .optional(),
});

export const listPagesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .optional()
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0, "Offset must be non-negative")
    .optional()
    .default(0),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "position"])
    .optional()
    .default("updatedAt"),
  order: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable()
    .optional(),
});

export type CreatePagePayload = z.infer<typeof createPageSchema>;
export type UpdatePagePayload = z.infer<typeof updatePageSchema>;
export type ListPagesQuery = z.infer<typeof listPagesQuerySchema>;
```

---

### Step 3: Create List and Create API Route

This route handles `GET /api/pages` (list with pagination, sorting, filtering) and `POST /api/pages` (create a new page). Both endpoints are wrapped with `withTenant()` to inject the tenant context.

**File: `src/app/api/pages/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import {
  successResponse,
  listResponse,
  errorResponse,
} from "@/lib/apiResponse";
import {
  createPageSchema,
  listPagesQuerySchema,
} from "@/lib/validation/pages";
import { TenantContext } from "@/types/auth";

export const GET = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      // Handle parentId=null as literal null filter
      const rawParentId = searchParams.get("parentId");
      if (rawParentId === "null") {
        queryParams.parentId = null as unknown as string;
      }

      const parsed = listPagesQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse(
          400,
          "Invalid query parameters",
          parsed.error.flatten().fieldErrors
        );
      }

      const { limit, offset, sortBy, order, parentId } = parsed.data;

      const where: Record<string, unknown> = {
        tenant_id: context.tenantId,
      };

      // Filter by parentId: if explicitly provided, filter by it
      // parentId=null means root pages only
      if (parentId !== undefined) {
        where.parent_id = parentId;
      }

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          orderBy: { [sortBy]: order },
          skip: offset,
          take: limit,
        }),
        prisma.page.count({ where }),
      ]);

      const serializedPages = pages.map((page) => ({
        id: page.id,
        tenantId: page.tenant_id,
        parentId: page.parent_id,
        title: page.title,
        icon: page.icon,
        coverUrl: page.cover_url,
        position: page.position,
        createdAt: page.created_at.toISOString(),
        updatedAt: page.updated_at.toISOString(),
      }));

      return listResponse(serializedPages, total, limit, offset);
    } catch (error) {
      console.error("GET /api/pages error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);

export const POST = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const body = await req.json();
      const parsed = createPageSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          400,
          "Invalid request body",
          parsed.error.flatten().fieldErrors
        );
      }

      const { title, parentId, icon, coverUrl } = parsed.data;

      // If parentId is provided, verify the parent exists and belongs to this tenant
      if (parentId) {
        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenant_id: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse(404, "Parent page not found");
        }
      }

      // Calculate the next position among siblings
      const maxPosition = await prisma.page.aggregate({
        where: {
          tenant_id: context.tenantId,
          parent_id: parentId,
        },
        _max: { position: true },
      });
      const nextPosition = (maxPosition._max.position ?? -1) + 1;

      const page = await prisma.page.create({
        data: {
          tenant_id: context.tenantId,
          parent_id: parentId,
          title,
          icon,
          cover_url: coverUrl,
          position: nextPosition,
        },
      });

      const serializedPage = {
        id: page.id,
        tenantId: page.tenant_id,
        parentId: page.parent_id,
        title: page.title,
        icon: page.icon,
        coverUrl: page.cover_url,
        position: page.position,
        createdAt: page.created_at.toISOString(),
        updatedAt: page.updated_at.toISOString(),
      };

      return successResponse(serializedPage, 201);
    } catch (error) {
      console.error("POST /api/pages error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);
```

---

### Step 4: Create Single Page API Route (GET, PUT, DELETE)

This route handles operations on a specific page identified by its UUID. All endpoints verify the page belongs to the authenticated tenant before operating on it.

**File: `src/app/api/pages/[id]/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import {
  successResponse,
  errorResponse,
} from "@/lib/apiResponse";
import { updatePageSchema } from "@/lib/validation/pages";
import { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

function serializePage(page: {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: page.id,
    tenantId: page.tenant_id,
    parentId: page.parent_id,
    title: page.title,
    icon: page.icon,
    coverUrl: page.cover_url,
    position: page.position,
    createdAt: page.created_at.toISOString(),
    updatedAt: page.updated_at.toISOString(),
  };
}

export const GET = withTenant(
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

      const page = await prisma.page.findFirst({
        where: {
          id: idParsed.data,
          tenant_id: context.tenantId,
        },
      });

      if (!page) {
        return errorResponse(404, "Page not found");
      }

      return successResponse(serializePage(page));
    } catch (error) {
      console.error("GET /api/pages/[id] error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);

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

      // If parentId is being changed, validate the new parent
      if (parentId !== undefined && parentId !== null) {
        // Cannot set a page as its own parent
        if (parentId === idParsed.data) {
          return errorResponse(400, "A page cannot be its own parent");
        }

        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenant_id: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse(404, "Parent page not found");
        }
      }

      // Build the update data object, only including provided fields
      const updateData: Record<string, unknown> = {
        updated_at: new Date(),
      };
      if (title !== undefined) updateData.title = title;
      if (parentId !== undefined) updateData.parent_id = parentId;
      if (icon !== undefined) updateData.icon = icon;
      if (coverUrl !== undefined) updateData.cover_url = coverUrl;

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

export const DELETE = withTenant(
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

      // Verify the page exists and belongs to this tenant
      const existingPage = await prisma.page.findFirst({
        where: { id: idParsed.data, tenant_id: context.tenantId },
      });
      if (!existingPage) {
        return errorResponse(404, "Page not found");
      }

      // Hard delete the page (MVP approach)
      // Note: child pages are NOT automatically deleted — they become root pages
      // or the DB cascades depending on schema constraint
      await prisma.page.delete({
        where: { id: idParsed.data },
      });

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("DELETE /api/pages/[id] error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);
```

---

### Step 5: Create TanStack Query Hooks for Pages

These hooks provide the client-side data fetching layer. All page data flows through these hooks, enabling caching, optimistic updates, and automatic refetching.

**File: `src/hooks/usePages.ts`**

```typescript
"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { Page, CreatePageInput, UpdatePageInput } from "@/types/page";

interface ListPagesParams {
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "title" | "position";
  order?: "asc" | "desc";
  parentId?: string | null;
}

interface ListPagesResponse {
  data: Page[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface SinglePageResponse {
  data: Page;
  meta: Record<string, unknown>;
}

async function fetchPages(params: ListPagesParams): Promise<ListPagesResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.order) searchParams.set("order", params.order);
  if (params.parentId !== undefined) {
    searchParams.set("parentId", params.parentId === null ? "null" : params.parentId);
  }

  const response = await fetch(`/api/pages?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch pages");
  }
  return response.json();
}

async function fetchPage(id: string): Promise<SinglePageResponse> {
  const response = await fetch(`/api/pages/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch page");
  }
  return response.json();
}

async function createPage(input: CreatePageInput): Promise<SinglePageResponse> {
  const response = await fetch("/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create page");
  }
  return response.json();
}

async function updatePage({
  id,
  ...input
}: UpdatePageInput & { id: string }): Promise<SinglePageResponse> {
  const response = await fetch(`/api/pages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update page");
  }
  return response.json();
}

async function deletePage(id: string): Promise<void> {
  const response = await fetch(`/api/pages/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to delete page");
  }
}

// --- Query Keys ---

export const pageKeys = {
  all: ["pages"] as const,
  lists: () => [...pageKeys.all, "list"] as const,
  list: (params: ListPagesParams) => [...pageKeys.lists(), params] as const,
  details: () => [...pageKeys.all, "detail"] as const,
  detail: (id: string) => [...pageKeys.details(), id] as const,
  tree: () => [...pageKeys.all, "tree"] as const,
};

// --- Hooks ---

export function usePages(
  params: ListPagesParams = {},
  options?: Partial<UseQueryOptions<ListPagesResponse>>
) {
  return useQuery({
    queryKey: pageKeys.list(params),
    queryFn: () => fetchPages(params),
    ...options,
  });
}

export function usePage(id: string, options?: Partial<UseQueryOptions<SinglePageResponse>>) {
  return useQuery({
    queryKey: pageKeys.detail(id),
    queryFn: () => fetchPage(id),
    enabled: !!id,
    ...options,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePage,
    onSuccess: (data) => {
      queryClient.setQueryData(pageKeys.detail(data.data.id), data);
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    },
  });
}
```

---

### Step 6: Create the PageHeader Component

The PageHeader displays the page title (editable inline), the emoji icon (clickable), and the cover image area. This component is used in the page view and will be enhanced in SKB-03.5 with the emoji picker and cover image management.

**File: `src/components/workspace/PageHeader.tsx`**

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useUpdatePage } from "@/hooks/usePages";
import type { Page } from "@/types/page";

interface PageHeaderProps {
  page: Page;
}

export function PageHeader({ page }: PageHeaderProps) {
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updatePage = useUpdatePage();

  // Sync title when page data changes externally
  useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

  const handleTitleBlur = useCallback(() => {
    const newTitle = title.trim() || "Untitled";
    if (newTitle !== page.title) {
      updatePage.mutate({ id: page.id, title: newTitle });
    }
  }, [title, page.id, page.title, updatePage]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleRef.current?.blur();
      }
    },
    []
  );

  return (
    <div className="w-full">
      {/* Cover Image Area */}
      {page.coverUrl && (
        <div className="relative w-full h-48 overflow-hidden rounded-b-lg">
          <img
            src={page.coverUrl}
            alt="Page cover"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Icon and Title */}
      <div className="px-16 pt-8 pb-4 max-w-4xl mx-auto">
        {/* Icon */}
        {page.icon && (
          <div className="mb-2">
            <button
              className="text-5xl hover:bg-gray-100 rounded-lg p-2 transition-colors"
              aria-label="Change page icon"
            >
              {page.icon}
            </button>
          </div>
        )}

        {/* Add Icon / Add Cover buttons (when not set) */}
        {(!page.icon || !page.coverUrl) && (
          <div className="flex gap-2 mb-2 opacity-0 hover:opacity-100 transition-opacity">
            {!page.icon && (
              <button
                className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                aria-label="Add icon"
              >
                Add icon
              </button>
            )}
            {!page.coverUrl && (
              <button
                className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                aria-label="Add cover"
              >
                Add cover
              </button>
            )}
          </div>
        )}

        {/* Editable Title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="text-4xl font-bold text-gray-900 outline-none focus:outline-none empty:before:content-['Untitled'] empty:before:text-gray-300 cursor-text"
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          onInput={(e) => setTitle(e.currentTarget.textContent || "")}
          role="textbox"
          aria-label="Page title"
        >
          {page.title}
        </h1>
      </div>
    </div>
  );
}
```

---

### Step 7: Create the Basic Page View

This is the main page view component at the workspace route. It fetches the page data using TanStack Query and renders the PageHeader with an editor placeholder area.

**File: `src/app/(workspace)/pages/[id]/page.tsx`**

```tsx
"use client";

import { use } from "react";
import { usePage } from "@/hooks/usePages";
import { PageHeader } from "@/components/workspace/PageHeader";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default function PageView({ params }: PageViewProps) {
  const { id } = use(params);
  const { data, isLoading, error } = usePage(id);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto px-16 py-8">
        {/* Title skeleton */}
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto px-16 py-8">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-1">Error loading page</h2>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="w-full max-w-4xl mx-auto px-16 py-8">
        <p className="text-gray-500">Page not found.</p>
      </div>
    );
  }

  const page = data.data;

  return (
    <div className="w-full min-h-screen">
      <PageHeader page={page} />

      {/* Editor Placeholder */}
      <div className="px-16 max-w-4xl mx-auto">
        <div className="py-4 text-gray-400 border-t border-gray-100">
          <p className="text-base">
            Start writing, or press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded">
              /
            </kbd>{" "}
            for commands...
          </p>
          <p className="text-sm mt-2 text-gray-300">
            (Block editor will be provided by Epic 4)
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: Zod Schema Validation

**File: `src/__tests__/lib/validation/pages.test.ts`**

```typescript
import { describe, test, expect } from "vitest";
import {
  createPageSchema,
  updatePageSchema,
  listPagesQuerySchema,
} from "@/lib/validation/pages";

describe("createPageSchema", () => {
  test("accepts valid input with all fields", () => {
    const result = createPageSchema.safeParse({
      title: "My Page",
      parentId: "550e8400-e29b-41d4-a716-446655440000",
      icon: "📄",
      coverUrl: "https://example.com/cover.jpg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("My Page");
      expect(result.data.parentId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.data.icon).toBe("📄");
      expect(result.data.coverUrl).toBe("https://example.com/cover.jpg");
    }
  });

  test("defaults title to 'Untitled' when not provided", () => {
    const result = createPageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Untitled");
    }
  });

  test("defaults parentId to null when not provided", () => {
    const result = createPageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBeNull();
    }
  });

  test("rejects title longer than 500 characters", () => {
    const result = createPageSchema.safeParse({
      title: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid UUID for parentId", () => {
    const result = createPageSchema.safeParse({
      parentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid URL for coverUrl", () => {
    const result = createPageSchema.safeParse({
      coverUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  test("accepts null for optional nullable fields", () => {
    const result = createPageSchema.safeParse({
      parentId: null,
      icon: null,
      coverUrl: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("updatePageSchema", () => {
  test("accepts partial update with title only", () => {
    const result = updatePageSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("New Title");
      expect(result.data.parentId).toBeUndefined();
    }
  });

  test("accepts empty object (no fields to update)", () => {
    const result = updatePageSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects title longer than 500 characters", () => {
    const result = updatePageSchema.safeParse({
      title: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("listPagesQuerySchema", () => {
  test("applies defaults when no parameters provided", () => {
    const result = listPagesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.sortBy).toBe("updatedAt");
      expect(result.data.order).toBe("desc");
    }
  });

  test("coerces string numbers to integers", () => {
    const result = listPagesQuerySchema.safeParse({
      limit: "50",
      offset: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(10);
    }
  });

  test("rejects limit above 100", () => {
    const result = listPagesQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  test("rejects negative offset", () => {
    const result = listPagesQuerySchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid sortBy value", () => {
    const result = listPagesQuerySchema.safeParse({ sortBy: "invalid" });
    expect(result.success).toBe(false);
  });

  test("accepts valid sortBy and order values", () => {
    const result = listPagesQuerySchema.safeParse({
      sortBy: "title",
      order: "asc",
    });
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests: CRUD Cycle and Tenant Isolation

**File: `src/__tests__/api/pages/route.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";

// Helpers to create test data and call API routes
// These assume a test helper that creates authenticated requests with tenant context

const TENANT_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("Page CRUD API", () => {
  beforeEach(async () => {
    // Clean up test pages
    await prisma.page.deleteMany({
      where: {
        tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] },
      },
    });
  });

  afterEach(async () => {
    await prisma.page.deleteMany({
      where: {
        tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] },
      },
    });
  });

  test("POST /api/pages creates a page and returns it with 201", async () => {
    const response = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ title: "Test Page" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.title).toBe("Test Page");
    expect(body.data.id).toBeDefined();
    expect(body.data.parentId).toBeNull();
  });

  test("GET /api/pages returns paginated list", async () => {
    // Create test pages
    await prisma.page.createMany({
      data: [
        { tenant_id: TENANT_A_ID, title: "Page 1", position: 0 },
        { tenant_id: TENANT_A_ID, title: "Page 2", position: 1 },
        { tenant_id: TENANT_A_ID, title: "Page 3", position: 2 },
      ],
    });

    const response = await fetch(
      "http://localhost:3000/api/pages?limit=2&offset=0",
      {
        headers: { Authorization: "Bearer test-tenant-a-key" },
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(3);
    expect(body.meta.limit).toBe(2);
    expect(body.meta.offset).toBe(0);
  });

  test("GET /api/pages/[id] returns single page", async () => {
    const page = await prisma.page.create({
      data: { tenant_id: TENANT_A_ID, title: "Detail Page", position: 0 },
    });

    const response = await fetch(
      `http://localhost:3000/api/pages/${page.id}`,
      {
        headers: { Authorization: "Bearer test-tenant-a-key" },
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.title).toBe("Detail Page");
    expect(body.data.id).toBe(page.id);
  });

  test("PUT /api/pages/[id] updates page title", async () => {
    const page = await prisma.page.create({
      data: { tenant_id: TENANT_A_ID, title: "Old Title", position: 0 },
    });

    const response = await fetch(
      `http://localhost:3000/api/pages/${page.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ title: "New Title" }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.title).toBe("New Title");
  });

  test("DELETE /api/pages/[id] removes page and returns 204", async () => {
    const page = await prisma.page.create({
      data: { tenant_id: TENANT_A_ID, title: "To Delete", position: 0 },
    });

    const response = await fetch(
      `http://localhost:3000/api/pages/${page.id}`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer test-tenant-a-key" },
      }
    );

    expect(response.status).toBe(204);

    // Verify deletion
    const deleted = await prisma.page.findUnique({ where: { id: page.id } });
    expect(deleted).toBeNull();
  });

  test("tenant isolation: tenant A cannot see tenant B pages", async () => {
    const pageTenantB = await prisma.page.create({
      data: { tenant_id: TENANT_B_ID, title: "Tenant B Page", position: 0 },
    });

    // Tenant A tries to read Tenant B's page
    const response = await fetch(
      `http://localhost:3000/api/pages/${pageTenantB.id}`,
      {
        headers: { Authorization: "Bearer test-tenant-a-key" },
      }
    );

    expect(response.status).toBe(404);
  });

  test("POST /api/pages returns 400 for invalid input", async () => {
    const response = await fetch("http://localhost:3000/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ parentId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
  });
});
```

### Component Tests: PageHeader

**File: `src/__tests__/components/workspace/PageHeader.test.tsx`**

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageHeader } from "@/components/workspace/PageHeader";
import type { Page } from "@/types/page";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockPage: Page = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "tenant-1",
  parentId: null,
  title: "Test Page Title",
  icon: null,
  coverUrl: null,
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PageHeader", () => {
  test("renders the page title", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    expect(screen.getByRole("textbox", { name: /page title/i })).toHaveTextContent(
      "Test Page Title"
    );
  });

  test("renders cover image when coverUrl is set", () => {
    const pageWithCover = { ...mockPage, coverUrl: "https://example.com/cover.jpg" };
    render(<PageHeader page={pageWithCover} />, { wrapper: createWrapper() });
    const img = screen.getByAltText("Page cover");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
  });

  test("renders icon when icon is set", () => {
    const pageWithIcon = { ...mockPage, icon: "📄" };
    render(<PageHeader page={pageWithIcon} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Change page icon")).toHaveTextContent("📄");
  });

  test("shows 'Add icon' button when no icon is set", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Add icon")).toBeInTheDocument();
  });

  test("shows 'Add cover' button when no cover is set", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Add cover")).toBeInTheDocument();
  });

  test("title is editable via contentEditable", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    const titleElement = screen.getByRole("textbox", { name: /page title/i });
    expect(titleElement).toHaveAttribute("contenteditable", "true");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/types/page.ts` |
| CREATE | `src/lib/validation/pages.ts` |
| CREATE | `src/app/api/pages/route.ts` |
| CREATE | `src/app/api/pages/[id]/route.ts` |
| CREATE | `src/hooks/usePages.ts` |
| CREATE | `src/components/workspace/PageHeader.tsx` |
| MODIFY | `src/app/(workspace)/pages/[id]/page.tsx` |
| CREATE | `src/__tests__/lib/validation/pages.test.ts` |
| CREATE | `src/__tests__/api/pages/route.test.ts` |
| CREATE | `src/__tests__/components/workspace/PageHeader.test.tsx` |

---

**Last Updated:** 2026-02-21
