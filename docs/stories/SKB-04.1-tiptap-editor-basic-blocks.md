# Story SKB-04.1: TipTap Editor Integration with Basic Blocks

**Epic:** Epic 4 - Block Editor
**Story ID:** SKB-04.1
**Story Points:** 8 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-03.1 (Page CRUD API and Basic Page View)

---

## User Story

As a researcher, I want a rich block editor in my pages, So that I can write and structure my notes with headings, lists, and quotes.

---

## Acceptance Criteria

- [ ] TipTap 3 editor mounts inside the PageView component, replacing the placeholder from Epic 3
- [ ] StarterKit extensions configured: paragraph, heading (H1-H3), bullet list, ordered list, blockquote, horizontal rule
- [ ] Placeholder extension shows "Type '/' for commands..." in empty editor
- [ ] Editor content serialized to TipTap JSON and stored as single DOCUMENT block in PostgreSQL via blocks API
- [ ] Auto-save fires 1 second after last edit (debounced), persisting editor content via PUT endpoint
- [ ] Manual save via Ctrl+S / Cmd+S also triggers save
- [ ] Save status indicator displays "Saving...", "Saved", or "Error saving" in the page header area
- [ ] POST /api/blocks creates a new block record with tenant_id, page_id, type, content, position
- [ ] GET /api/blocks/[id] returns a single block by ID (tenant-scoped)
- [ ] PUT /api/blocks/[id] updates block content and/or type
- [ ] DELETE /api/blocks/[id] soft-deletes a block
- [ ] GET /api/pages/[id]/blocks returns all blocks for a page, ordered by position
- [ ] PUT /api/pages/[id]/blocks saves full TipTap document as DOCUMENT block (upsert)
- [ ] All block API endpoints wrapped with withTenant() for tenant isolation
- [ ] All inputs validated with Zod schemas (block type enum, content size limit 1MB)
- [ ] Page content loads on mount: fetches blocks via TanStack Query, deserializes JSON into TipTap
- [ ] Optimistic updates via TanStack Query mutation — editor does not flash on save
- [ ] Empty pages start with an empty paragraph block
- [ ] Editor is keyboard-accessible: Tab/Shift+Tab for list indentation
- [ ] TypeScript strict mode — all editor types fully typed, no `any`

---

## Architecture Overview

```
PageView (from SKB-03.1)
┌─────────────────────────────────────────────────────────────────┐
│  PageHeader (icon, title, save status)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Save Status: [Saved ✓] / [Saving...] / [Error ✗]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BlockEditor.tsx                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  TipTap useEditor()                                │    │   │
│  │  │                                                    │    │   │
│  │  │  Extensions:                                       │    │   │
│  │  │  - StarterKit (paragraph, H1-H3, lists, quote)    │    │   │
│  │  │  - Placeholder ("Type '/' for commands...")        │    │   │
│  │  │                                                    │    │   │
│  │  │  Content ←→ TipTap JSON Document                   │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  useAutoSave(editor, pageId)                             │   │
│  │  ├── onChange → debounce(1000ms) → PUT /api/pages/:id/blocks │
│  │  └── Ctrl+S → immediate save                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                                    ▲
         │  PUT /api/pages/:id/blocks         │  GET /api/pages/:id/blocks
         │  (save document)                   │  (load document)
         ▼                                    │
┌─────────────────────────────────────────────────────────────────┐
│  API Layer (Next.js Route Handlers)                              │
│                                                                  │
│  src/app/api/pages/[id]/blocks/route.ts                          │
│  ├── GET  — Load all blocks for page (ordered by position)       │
│  └── PUT  — Save full TipTap document (upsert DOCUMENT block)   │
│                                                                  │
│  src/app/api/blocks/route.ts                                     │
│  └── POST — Create individual block (for AI agents)              │
│                                                                  │
│  src/app/api/blocks/[id]/route.ts                                │
│  ├── GET    — Read single block                                  │
│  ├── PUT    — Update single block                                │
│  └── DELETE — Soft-delete block                                  │
│                                                                  │
│  All wrapped with withTenant()                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL 18 — blocks table                                    │
│                                                                  │
│  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()          │
│  tenant_id   UUID NOT NULL → tenants(id)                         │
│  page_id     UUID NOT NULL → pages(id) ON DELETE CASCADE         │
│  type        block_type NOT NULL (DOCUMENT, PARAGRAPH, etc.)     │
│  content     JSONB NOT NULL DEFAULT '{}'                         │
│  position    INTEGER NOT NULL DEFAULT 0                          │
│  created_at  TIMESTAMPTZ DEFAULT now()                           │
│  updated_at  TIMESTAMPTZ DEFAULT now()                           │
│  deleted_at  TIMESTAMPTZ (soft-delete)                           │
│                                                                  │
│  INDEX: (tenant_id, page_id, position)                           │
│  UNIQUE: (tenant_id, page_id) WHERE type = 'DOCUMENT'           │
│          (one document block per page per tenant)                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Single DOCUMENT block per page:** The TipTap editor manages a single document. For the web UI, the entire TipTap JSON is stored as one block with `type=DOCUMENT`. Individual block CRUD endpoints exist primarily for AI agent access (they can read/write individual blocks by position).

2. **Auto-save with debounce:** The editor fires `onUpdate` on every keystroke. A 1-second debounce ensures saves only happen after the user pauses typing. This balances responsiveness with server load.

3. **TanStack Query for data fetching:** Using `useQuery` for loading and `useMutation` for saving ensures proper cache management, optimistic updates, and error handling without custom state management.

---

## Implementation Steps

### Step 1: Create Zod Validation Schemas for Blocks

Define the validation schemas used by all block API endpoints. These schemas enforce the BlockType enum, content size limits, and required fields.

**File: `src/lib/validation/blocks.ts`**

```typescript
import { z } from "zod";

// Block types supported by the editor
export const BlockType = z.enum([
  "DOCUMENT",
  "PARAGRAPH",
  "HEADING",
  "BULLET_LIST",
  "ORDERED_LIST",
  "TASK_LIST",
  "BLOCKQUOTE",
  "CODE_BLOCK",
  "IMAGE",
  "CALLOUT",
  "TOGGLE",
  "BOOKMARK",
  "DIVIDER",
]);

export type BlockType = z.infer<typeof BlockType>;

// Maximum content size: 1MB when serialized
const MAX_CONTENT_SIZE = 1_000_000;

// Validate that JSON content does not exceed size limit
const jsonContent = z
  .record(z.unknown())
  .refine(
    (val) => JSON.stringify(val).length <= MAX_CONTENT_SIZE,
    { message: `Block content must not exceed ${MAX_CONTENT_SIZE} bytes` }
  );

// Schema for creating a new block
export const createBlockSchema = z.object({
  page_id: z.string().uuid("Invalid page ID"),
  type: BlockType,
  content: jsonContent,
  position: z.number().int().min(0).default(0),
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;

// Schema for updating an existing block
export const updateBlockSchema = z.object({
  type: BlockType.optional(),
  content: jsonContent.optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;

// Schema for saving the full TipTap document for a page
export const saveDocumentSchema = z.object({
  content: jsonContent,
});

export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

// Schema for block query parameters
export const blockQuerySchema = z.object({
  page_id: z.string().uuid("Invalid page ID").optional(),
  type: BlockType.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type BlockQueryInput = z.infer<typeof blockQuerySchema>;
```

**Why this schema design:**
- `BlockType` enum ensures only valid block types are accepted
- `jsonContent` validates JSONB size to prevent abuse (1MB limit from architecture constraints)
- Separate schemas for create, update, and document save operations reflect different required fields
- All UUIDs validated at the schema level to prevent invalid database queries

---

### Step 2: Create Block API Route — Page Blocks (GET, PUT)

This route handles loading all blocks for a page and saving the full TipTap document.

**File: `src/app/api/pages/[id]/blocks/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { saveDocumentSchema } from "@/lib/validation/blocks";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// GET /api/pages/:id/blocks — Load all blocks for a page
export const GET = withTenant(
  async (
    req: NextRequest,
    context: { params: Promise<{ id: string }>; tenantId: string; userId: string }
  ) => {
    const { id: pageId } = await context.params;
    const { tenantId } = context;

    try {
      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: {
          id: pageId,
          tenant_id: tenantId,
          deleted_at: null,
        },
      });

      if (!page) {
        return NextResponse.json(
          apiError("Page not found", 404),
          { status: 404 }
        );
      }

      // Fetch all blocks for the page, ordered by position
      const blocks = await prisma.block.findMany({
        where: {
          page_id: pageId,
          tenant_id: tenantId,
          deleted_at: null,
        },
        orderBy: { position: "asc" },
      });

      return NextResponse.json(
        apiSuccess(blocks, {
          count: blocks.length,
          page_id: pageId,
        })
      );
    } catch (error) {
      console.error("Failed to fetch blocks:", error);
      return NextResponse.json(
        apiError("Failed to fetch blocks", 500),
        { status: 500 }
      );
    }
  }
);

// PUT /api/pages/:id/blocks — Save full TipTap document (upsert DOCUMENT block)
export const PUT = withTenant(
  async (
    req: NextRequest,
    context: { params: Promise<{ id: string }>; tenantId: string; userId: string }
  ) => {
    const { id: pageId } = await context.params;
    const { tenantId } = context;

    try {
      // Parse and validate request body
      const body = await req.json();
      const parsed = saveDocumentSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          apiError("Invalid input", 400, parsed.error.flatten().fieldErrors),
          { status: 400 }
        );
      }

      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: {
          id: pageId,
          tenant_id: tenantId,
          deleted_at: null,
        },
      });

      if (!page) {
        return NextResponse.json(
          apiError("Page not found", 404),
          { status: 404 }
        );
      }

      // Upsert the DOCUMENT block — one per page
      const block = await prisma.block.upsert({
        where: {
          // Use the unique constraint: (tenant_id, page_id) WHERE type = 'DOCUMENT'
          tenant_page_document: {
            tenant_id: tenantId,
            page_id: pageId,
            type: "DOCUMENT",
          },
        },
        update: {
          content: parsed.data.content,
          updated_at: new Date(),
        },
        create: {
          tenant_id: tenantId,
          page_id: pageId,
          type: "DOCUMENT",
          content: parsed.data.content,
          position: 0,
        },
      });

      return NextResponse.json(apiSuccess(block));
    } catch (error) {
      console.error("Failed to save document:", error);
      return NextResponse.json(
        apiError("Failed to save document", 500),
        { status: 500 }
      );
    }
  }
);
```

---

### Step 3: Create Block API Route — Individual Blocks (POST)

This route handles creating individual blocks, primarily for AI agent access.

**File: `src/app/api/blocks/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { createBlockSchema } from "@/lib/validation/blocks";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// POST /api/blocks — Create a new block
export const POST = withTenant(
  async (
    req: NextRequest,
    context: { tenantId: string; userId: string }
  ) => {
    const { tenantId } = context;

    try {
      const body = await req.json();
      const parsed = createBlockSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          apiError("Invalid input", 400, parsed.error.flatten().fieldErrors),
          { status: 400 }
        );
      }

      const { page_id, type, content, position } = parsed.data;

      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: {
          id: page_id,
          tenant_id: tenantId,
          deleted_at: null,
        },
      });

      if (!page) {
        return NextResponse.json(
          apiError("Page not found", 404),
          { status: 404 }
        );
      }

      // Shift positions of existing blocks at or after the insertion point
      await prisma.block.updateMany({
        where: {
          page_id,
          tenant_id: tenantId,
          position: { gte: position },
          deleted_at: null,
        },
        data: {
          position: { increment: 1 },
        },
      });

      // Create the new block
      const block = await prisma.block.create({
        data: {
          tenant_id: tenantId,
          page_id,
          type,
          content,
          position,
        },
      });

      return NextResponse.json(apiSuccess(block), { status: 201 });
    } catch (error) {
      console.error("Failed to create block:", error);
      return NextResponse.json(
        apiError("Failed to create block", 500),
        { status: 500 }
      );
    }
  }
);
```

---

### Step 4: Create Block API Route — Single Block (GET, PUT, DELETE)

**File: `src/app/api/blocks/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { updateBlockSchema } from "@/lib/validation/blocks";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// GET /api/blocks/:id — Read a single block
export const GET = withTenant(
  async (
    req: NextRequest,
    context: { params: Promise<{ id: string }>; tenantId: string; userId: string }
  ) => {
    const { id: blockId } = await context.params;
    const { tenantId } = context;

    try {
      const block = await prisma.block.findFirst({
        where: {
          id: blockId,
          tenant_id: tenantId,
          deleted_at: null,
        },
      });

      if (!block) {
        return NextResponse.json(
          apiError("Block not found", 404),
          { status: 404 }
        );
      }

      return NextResponse.json(apiSuccess(block));
    } catch (error) {
      console.error("Failed to fetch block:", error);
      return NextResponse.json(
        apiError("Failed to fetch block", 500),
        { status: 500 }
      );
    }
  }
);

// PUT /api/blocks/:id — Update a single block
export const PUT = withTenant(
  async (
    req: NextRequest,
    context: { params: Promise<{ id: string }>; tenantId: string; userId: string }
  ) => {
    const { id: blockId } = await context.params;
    const { tenantId } = context;

    try {
      const body = await req.json();
      const parsed = updateBlockSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          apiError("Invalid input", 400, parsed.error.flatten().fieldErrors),
          { status: 400 }
        );
      }

      // Verify block exists and belongs to tenant
      const existing = await prisma.block.findFirst({
        where: {
          id: blockId,
          tenant_id: tenantId,
          deleted_at: null,
        },
      });

      if (!existing) {
        return NextResponse.json(
          apiError("Block not found", 404),
          { status: 404 }
        );
      }

      const block = await prisma.block.update({
        where: { id: blockId },
        data: {
          ...parsed.data,
          updated_at: new Date(),
        },
      });

      return NextResponse.json(apiSuccess(block));
    } catch (error) {
      console.error("Failed to update block:", error);
      return NextResponse.json(
        apiError("Failed to update block", 500),
        { status: 500 }
      );
    }
  }
);

// DELETE /api/blocks/:id — Soft-delete a block
export const DELETE = withTenant(
  async (
    req: NextRequest,
    context: { params: Promise<{ id: string }>; tenantId: string; userId: string }
  ) => {
    const { id: blockId } = await context.params;
    const { tenantId } = context;

    try {
      // Verify block exists and belongs to tenant
      const existing = await prisma.block.findFirst({
        where: {
          id: blockId,
          tenant_id: tenantId,
          deleted_at: null,
        },
      });

      if (!existing) {
        return NextResponse.json(
          apiError("Block not found", 404),
          { status: 404 }
        );
      }

      // Soft-delete
      await prisma.block.update({
        where: { id: blockId },
        data: { deleted_at: new Date() },
      });

      return NextResponse.json(apiSuccess({ id: blockId, deleted: true }));
    } catch (error) {
      console.error("Failed to delete block:", error);
      return NextResponse.json(
        apiError("Failed to delete block", 500),
        { status: 500 }
      );
    }
  }
);
```

---

### Step 5: Create Editor TypeScript Types

**File: `src/types/editor.ts`**

```typescript
import type { JSONContent } from "@tiptap/react";
import type { BlockType } from "@/lib/validation/blocks";

// Block record as returned from the API
export interface Block {
  id: string;
  tenant_id: string;
  page_id: string;
  type: BlockType;
  content: JSONContent;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Save status for the editor
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Editor configuration options
export interface EditorConfig {
  pageId: string;
  editable?: boolean;
  placeholder?: string;
  onSaveStatusChange?: (status: SaveStatus) => void;
}

// Auto-save hook options
export interface AutoSaveOptions {
  pageId: string;
  debounceMs?: number;
  onStatusChange?: (status: SaveStatus) => void;
}

// API response envelope types (matches apiResponse.ts)
export interface ApiSuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: string;
  meta?: Record<string, unknown>;
}
```

---

### Step 6: Create TanStack Query Hooks for Block Data

**File: `src/hooks/useBlockEditor.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import type { Block, ApiSuccessResponse } from "@/types/editor";

// Query key factory for blocks
export const blockKeys = {
  all: ["blocks"] as const,
  byPage: (pageId: string) => ["blocks", "page", pageId] as const,
  byId: (blockId: string) => ["blocks", blockId] as const,
};

// Fetch all blocks for a page
async function fetchPageBlocks(pageId: string): Promise<Block[]> {
  const res = await fetch(`/api/pages/${pageId}/blocks`);
  if (!res.ok) {
    throw new Error(`Failed to fetch blocks: ${res.status}`);
  }
  const json: ApiSuccessResponse<Block[]> = await res.json();
  return json.data;
}

// Save full TipTap document for a page
async function savePageDocument(
  pageId: string,
  content: JSONContent
): Promise<Block> {
  const res = await fetch(`/api/pages/${pageId}/blocks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save document: ${res.status}`);
  }
  const json: ApiSuccessResponse<Block> = await res.json();
  return json.data;
}

// Hook: Load page blocks
export function usePageBlocks(pageId: string) {
  return useQuery({
    queryKey: blockKeys.byPage(pageId),
    queryFn: () => fetchPageBlocks(pageId),
    enabled: !!pageId,
    staleTime: 30_000, // 30 seconds before refetch
  });
}

// Hook: Save page document with optimistic updates
export function useSaveDocument(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: JSONContent) => savePageDocument(pageId, content),
    onMutate: async (newContent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: blockKeys.byPage(pageId),
      });

      // Snapshot previous value
      const previousBlocks = queryClient.getQueryData<Block[]>(
        blockKeys.byPage(pageId)
      );

      // Optimistically update the cache
      if (previousBlocks) {
        const documentBlock = previousBlocks.find(
          (b) => b.type === "DOCUMENT"
        );
        if (documentBlock) {
          const updated = previousBlocks.map((b) =>
            b.type === "DOCUMENT"
              ? { ...b, content: newContent, updated_at: new Date().toISOString() }
              : b
          );
          queryClient.setQueryData(blockKeys.byPage(pageId), updated);
        }
      }

      return { previousBlocks };
    },
    onError: (_err, _newContent, context) => {
      // Rollback on error
      if (context?.previousBlocks) {
        queryClient.setQueryData(
          blockKeys.byPage(pageId),
          context.previousBlocks
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({
        queryKey: blockKeys.byPage(pageId),
      });
    },
  });
}
```

---

### Step 7: Create Auto-Save Hook

**File: `src/hooks/useAutoSave.ts`**

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useSaveDocument } from "@/hooks/useBlockEditor";
import type { SaveStatus } from "@/types/editor";

const DEFAULT_DEBOUNCE_MS = 1000;

interface UseAutoSaveOptions {
  editor: Editor | null;
  pageId: string;
  debounceMs?: number;
  onStatusChange?: (status: SaveStatus) => void;
}

export function useAutoSave({
  editor,
  pageId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onStatusChange,
}: UseAutoSaveOptions) {
  const saveDocument = useSaveDocument(pageId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<SaveStatus>("idle");

  // Update save status and notify callback
  const setStatus = useCallback(
    (status: SaveStatus) => {
      statusRef.current = status;
      onStatusChange?.(status);
    },
    [onStatusChange]
  );

  // Perform the actual save
  const performSave = useCallback(() => {
    if (!editor) return;

    const content = editor.getJSON();
    setStatus("saving");

    saveDocument.mutate(content, {
      onSuccess: () => {
        setStatus("saved");
      },
      onError: () => {
        setStatus("error");
      },
    });
  }, [editor, saveDocument, setStatus]);

  // Debounced save triggered by editor changes
  const debouncedSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [performSave, debounceMs]);

  // Immediate save (for Ctrl+S)
  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    performSave();
  }, [performSave]);

  // Listen to editor updates
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      debouncedSave();
    };

    editor.on("update", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor, debouncedSave]);

  // Handle Ctrl+S / Cmd+S for manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveNow]);

  // Save before unload (best-effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timerRef.current && editor) {
        clearTimeout(timerRef.current);
        // Use sendBeacon for reliable save on page exit
        const content = editor.getJSON();
        const blob = new Blob(
          [JSON.stringify({ content })],
          { type: "application/json" }
        );
        navigator.sendBeacon(`/api/pages/${pageId}/blocks`, blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editor, pageId]);

  return {
    saveNow,
    isSaving: saveDocument.isPending,
    isError: saveDocument.isError,
    status: statusRef.current,
  };
}
```

**Why `sendBeacon` on beforeunload:** Regular `fetch` calls may be cancelled by the browser when navigating away. `navigator.sendBeacon` is specifically designed to reliably send data during page unload, ensuring the user's last edits are not lost.

---

### Step 8: Create TipTap Editor Configuration

**File: `src/lib/editor/editorConfig.ts`**

```typescript
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Extensions } from "@tiptap/react";

// Default placeholder text for empty editor
const DEFAULT_PLACEHOLDER = "Type '/' for commands...";

export interface EditorConfigOptions {
  placeholder?: string;
}

/**
 * Returns the base TipTap extensions for the block editor.
 *
 * StarterKit includes:
 * - Document, Paragraph, Text (core)
 * - Heading (H1-H3 configured)
 * - BulletList, OrderedList, ListItem
 * - Blockquote
 * - HorizontalRule
 * - HardBreak
 * - History (undo/redo — used by SKB-04.6)
 * - Bold, Italic, Strike, Code (marks — configured further in SKB-04.3)
 */
export function getBaseExtensions(
  options: EditorConfigOptions = {}
): Extensions {
  const { placeholder = DEFAULT_PLACEHOLDER } = options;

  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
      // History is included by default in StarterKit
      // Undo: Ctrl+Z, Redo: Ctrl+Shift+Z
      history: {
        depth: 100, // Keep last 100 undo steps
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") {
          const level = node.attrs.level as number;
          return `Heading ${level}`;
        }
        return placeholder;
      },
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
    }),
  ];
}
```

---

### Step 9: Create BlockEditor Component

**File: `src/components/editor/BlockEditor.tsx`**

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { getBaseExtensions } from "@/lib/editor/editorConfig";
import { usePageBlocks } from "@/hooks/useBlockEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/editor/SaveStatusIndicator";
import type { SaveStatus } from "@/types/editor";

interface BlockEditorProps {
  pageId: string;
  editable?: boolean;
}

export function BlockEditor({ pageId, editable = true }: BlockEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Fetch existing blocks for this page
  const { data: blocks, isLoading, isError } = usePageBlocks(pageId);

  // Extract the DOCUMENT block content (if it exists)
  const documentContent: JSONContent | undefined = blocks
    ?.find((b) => b.type === "DOCUMENT")
    ?.content as JSONContent | undefined;

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: getBaseExtensions(),
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-stone dark:prose-invert max-w-none min-h-[500px] px-8 py-4 focus:outline-none",
        "data-testid": "block-editor",
      },
    },
    // Do not set content here — we set it after data loads
    content: undefined,
    // Prevent re-render flash on blur
    autofocus: "end",
  });

  // Load content into editor when data arrives
  useEffect(() => {
    if (editor && documentContent && !editor.isDestroyed) {
      // Only set content if the editor is empty or this is initial load
      const currentContent = editor.getJSON();
      const isEmptyDoc =
        currentContent.content?.length === 1 &&
        currentContent.content[0].type === "paragraph" &&
        !currentContent.content[0].content;

      if (isEmptyDoc) {
        editor.commands.setContent(documentContent);
      }
    }
  }, [editor, documentContent]);

  // Auto-save hook
  const handleStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  useAutoSave({
    editor,
    pageId,
    debounceMs: 1000,
    onStatusChange: handleStatusChange,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-pulse text-gray-400">Loading editor...</div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-red-500">
          Failed to load page content. Please try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" data-testid="block-editor-container">
      {/* Save status indicator */}
      <div className="sticky top-0 z-10 flex justify-end px-8 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* TipTap editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
```

---

### Step 10: Create Save Status Indicator Component

**File: `src/components/editor/SaveStatusIndicator.tsx`**

```tsx
"use client";

import type { SaveStatus } from "@/types/editor";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
}

const statusConfig: Record<
  SaveStatus,
  { label: string; className: string }
> = {
  idle: {
    label: "",
    className: "text-transparent",
  },
  saving: {
    label: "Saving...",
    className: "text-gray-400 dark:text-gray-500",
  },
  saved: {
    label: "Saved",
    className: "text-green-600 dark:text-green-400",
  },
  error: {
    label: "Error saving",
    className: "text-red-600 dark:text-red-400",
  },
};

export function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  const config = statusConfig[status];

  if (status === "idle") return null;

  return (
    <span
      className={`text-sm font-medium transition-colors duration-200 ${config.className}`}
      data-testid="save-status"
      aria-live="polite"
    >
      {config.label}
    </span>
  );
}
```

---

### Step 11: Mount BlockEditor in PageView

Update the page view component from Epic 3 to mount the BlockEditor instead of the placeholder.

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (modification)

```tsx
import { BlockEditor } from "@/components/editor/BlockEditor";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default async function PageView({ params }: PageViewProps) {
  const { id: pageId } = await params;

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      {/* PageHeader component from Epic 3 renders icon, cover, title */}
      {/* <PageHeader pageId={pageId} /> */}

      {/* Block Editor — replaces the placeholder from Epic 3 */}
      <BlockEditor pageId={pageId} />
    </div>
  );
}
```

---

### Step 12: Add Editor Styles

**File: `src/components/editor/editor.css`**

```css
/* TipTap editor base styles */

/* Placeholder styling */
.tiptap p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Heading placeholder styling */
.tiptap h1.is-empty::before,
.tiptap h2.is-empty::before,
.tiptap h3.is-empty::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Focus ring for the editor */
.tiptap:focus {
  outline: none;
}

/* Blockquote styling */
.tiptap blockquote {
  border-left: 3px solid #d1d5db;
  padding-left: 1rem;
  margin-left: 0;
  color: #6b7280;
}

.dark .tiptap blockquote {
  border-left-color: #4b5563;
  color: #9ca3af;
}

/* Horizontal rule */
.tiptap hr {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 1.5rem 0;
}

.dark .tiptap hr {
  border-top-color: #374151;
}

/* List styling */
.tiptap ul {
  list-style-type: disc;
  padding-left: 1.5rem;
}

.tiptap ol {
  list-style-type: decimal;
  padding-left: 1.5rem;
}

.tiptap ul ul {
  list-style-type: circle;
}

.tiptap ul ul ul {
  list-style-type: square;
}
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/lib/validation/blocks.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  createBlockSchema,
  updateBlockSchema,
  saveDocumentSchema,
  BlockType,
} from "@/lib/validation/blocks";

describe("Block Validation Schemas", () => {
  describe("BlockType enum", () => {
    it("should accept valid block types", () => {
      expect(BlockType.parse("DOCUMENT")).toBe("DOCUMENT");
      expect(BlockType.parse("PARAGRAPH")).toBe("PARAGRAPH");
      expect(BlockType.parse("HEADING")).toBe("HEADING");
      expect(BlockType.parse("BULLET_LIST")).toBe("BULLET_LIST");
      expect(BlockType.parse("ORDERED_LIST")).toBe("ORDERED_LIST");
      expect(BlockType.parse("BLOCKQUOTE")).toBe("BLOCKQUOTE");
      expect(BlockType.parse("CODE_BLOCK")).toBe("CODE_BLOCK");
    });

    it("should reject invalid block types", () => {
      expect(() => BlockType.parse("INVALID")).toThrow();
      expect(() => BlockType.parse("")).toThrow();
      expect(() => BlockType.parse("paragraph")).toThrow(); // case-sensitive
    });
  });

  describe("createBlockSchema", () => {
    it("should accept valid create input", () => {
      const input = {
        page_id: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        position: 0,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject missing page_id", () => {
      const input = {
        type: "PARAGRAPH",
        content: {},
        position: 0,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID for page_id", () => {
      const input = {
        page_id: "not-a-uuid",
        type: "PARAGRAPH",
        content: {},
        position: 0,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject negative position", () => {
      const input = {
        page_id: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: {},
        position: -1,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should default position to 0 when not provided", () => {
      const input = {
        page_id: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: {},
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.position).toBe(0);
      }
    });

    it("should reject content exceeding 1MB", () => {
      const largeContent = { data: "x".repeat(1_000_001) };
      const input = {
        page_id: "550e8400-e29b-41d4-a716-446655440000",
        type: "PARAGRAPH",
        content: largeContent,
      };
      const result = createBlockSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("updateBlockSchema", () => {
    it("should accept partial update with only content", () => {
      const input = {
        content: { type: "paragraph", content: [] },
      };
      const result = updateBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept partial update with only type", () => {
      const input = { type: "HEADING" };
      const result = updateBlockSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept empty update", () => {
      const result = updateBlockSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("saveDocumentSchema", () => {
    it("should accept valid TipTap document JSON", () => {
      const input = {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hello world" }],
            },
          ],
        },
      };
      const result = saveDocumentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject missing content", () => {
      const result = saveDocumentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
```

### Integration Tests

**File: `tests/integration/api/blocks.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";

// Integration tests assume a test database and authenticated session
// These tests verify the full request → database → response cycle

describe("Block API Integration", () => {
  const BASE_URL = "http://localhost:3000";
  let testPageId: string;
  let authHeaders: Record<string, string>;

  beforeEach(async () => {
    // Setup: create a test page and obtain auth headers
    // (In a real test, this would use test fixtures)
    authHeaders = {
      "Content-Type": "application/json",
      Authorization: "Bearer sk_test_key",
    };
    testPageId = "test-page-uuid"; // Would be created in test setup
  });

  describe("PUT /api/pages/:id/blocks", () => {
    it("should save TipTap document and return the block", async () => {
      const content = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Test content" }],
          },
        ],
      };

      const res = await fetch(`${BASE_URL}/api/pages/${testPageId}/blocks`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ content }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.type).toBe("DOCUMENT");
      expect(json.data.content).toEqual(content);
      expect(json.data.page_id).toBe(testPageId);
    });

    it("should upsert on subsequent saves (not create duplicates)", async () => {
      const content1 = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }],
      };
      const content2 = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }],
      };

      // First save
      await fetch(`${BASE_URL}/api/pages/${testPageId}/blocks`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ content: content1 }),
      });

      // Second save (should update, not create)
      await fetch(`${BASE_URL}/api/pages/${testPageId}/blocks`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ content: content2 }),
      });

      // Fetch blocks — should have exactly one DOCUMENT block
      const res = await fetch(`${BASE_URL}/api/pages/${testPageId}/blocks`, {
        headers: authHeaders,
      });
      const json = await res.json();
      const docBlocks = json.data.filter(
        (b: { type: string }) => b.type === "DOCUMENT"
      );
      expect(docBlocks).toHaveLength(1);
      expect(docBlocks[0].content).toEqual(content2);
    });
  });

  describe("GET /api/pages/:id/blocks", () => {
    it("should return blocks ordered by position", async () => {
      const res = await fetch(`${BASE_URL}/api/pages/${testPageId}/blocks`, {
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta.page_id).toBe(testPageId);
    });

    it("should return 404 for non-existent page", async () => {
      const res = await fetch(
        `${BASE_URL}/api/pages/00000000-0000-0000-0000-000000000000/blocks`,
        { headers: authHeaders }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/blocks", () => {
    it("should create a new block", async () => {
      const res = await fetch(`${BASE_URL}/api/blocks`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          page_id: testPageId,
          type: "PARAGRAPH",
          content: { type: "paragraph", content: [] },
          position: 0,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.type).toBe("PARAGRAPH");
    });
  });

  describe("Tenant isolation", () => {
    it("should not return blocks from a different tenant", async () => {
      // This test would use a different tenant's auth headers
      // and verify that blocks from the first tenant are not visible
      const otherTenantHeaders = {
        "Content-Type": "application/json",
        Authorization: "Bearer sk_other_tenant_key",
      };

      const res = await fetch(`${BASE_URL}/api/pages/${testPageId}/blocks`, {
        headers: otherTenantHeaders,
      });

      // Should return 404 because the page doesn't exist for this tenant
      expect(res.status).toBe(404);
    });
  });
});
```

### Component Tests

**File: `tests/unit/components/editor/BlockEditor.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlockEditor } from "@/components/editor/BlockEditor";

// Mock the fetch API
global.fetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("BlockEditor", () => {
  it("should render loading state initially", () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => new Promise(() => {}), // Never resolves — stays loading
    });

    render(<BlockEditor pageId="test-page-id" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Loading editor...")).toBeDefined();
  });

  it("should render the editor after data loads", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "block-1",
            type: "DOCUMENT",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Hello world" }],
                },
              ],
            },
            position: 0,
          },
        ],
        meta: { count: 1, page_id: "test-page-id" },
      }),
    });

    render(<BlockEditor pageId="test-page-id" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("block-editor-container")).toBeDefined();
    });
  });

  it("should render error state on fetch failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<BlockEditor pageId="test-page-id" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load page content/)).toBeDefined();
    });
  });
});
```

### E2E Tests

**File: `tests/e2e/editor/block-editor.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Block Editor", () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to a test page
    // (assumes test fixtures create a page at this URL)
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should display the editor on page load", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await expect(editor).toBeVisible();
  });

  test("should show placeholder text in empty editor", async ({ page }) => {
    const placeholder = page.locator(".is-editor-empty");
    await expect(placeholder).toBeVisible();
  });

  test("should allow typing text", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello from the block editor");

    await expect(editor).toContainText("Hello from the block editor");
  });

  test("should create headings with keyboard shortcuts", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    // Type markdown-style heading
    await page.keyboard.type("# My Heading");
    await page.keyboard.press("Enter");

    const heading = page.locator("h1");
    await expect(heading).toContainText("My Heading");
  });

  test("should create bullet list", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    // Markdown shortcut for bullet list
    await page.keyboard.type("- First item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second item");

    const listItems = page.locator("li");
    await expect(listItems).toHaveCount(2);
  });

  test("should auto-save after typing", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Auto-save test content");

    // Wait for debounce + save
    const saveStatus = page.locator('[data-testid="save-status"]');
    await expect(saveStatus).toContainText("Saving...", { timeout: 2000 });
    await expect(saveStatus).toContainText("Saved", { timeout: 5000 });
  });

  test("should save on Ctrl+S", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Manual save content");

    // Trigger manual save
    await page.keyboard.press("Control+s");

    const saveStatus = page.locator('[data-testid="save-status"]');
    await expect(saveStatus).toContainText("Saved", { timeout: 5000 });
  });

  test("should persist content on reload", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Persist this content");

    // Wait for auto-save
    const saveStatus = page.locator('[data-testid="save-status"]');
    await expect(saveStatus).toContainText("Saved", { timeout: 5000 });

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="block-editor"]');

    // Verify content persisted
    const reloadedEditor = page.locator('[data-testid="block-editor"]');
    await expect(reloadedEditor).toContainText("Persist this content");
  });

  test("should create blockquote with markdown shortcut", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("> This is a quote");

    const blockquote = page.locator("blockquote");
    await expect(blockquote).toContainText("This is a quote");
  });

  test("should insert horizontal rule with markdown shortcut", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("---");

    const hr = page.locator("hr");
    await expect(hr).toBeVisible();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/validation/blocks.ts` |
| CREATE | `src/app/api/pages/[id]/blocks/route.ts` |
| CREATE | `src/app/api/blocks/route.ts` |
| CREATE | `src/app/api/blocks/[id]/route.ts` |
| CREATE | `src/types/editor.ts` |
| CREATE | `src/hooks/useBlockEditor.ts` |
| CREATE | `src/hooks/useAutoSave.ts` |
| CREATE | `src/lib/editor/editorConfig.ts` |
| CREATE | `src/components/editor/BlockEditor.tsx` |
| CREATE | `src/components/editor/SaveStatusIndicator.tsx` |
| CREATE | `src/components/editor/editor.css` |
| MODIFY | `src/app/(workspace)/pages/[id]/page.tsx` |
| CREATE | `tests/unit/lib/validation/blocks.test.ts` |
| CREATE | `tests/integration/api/blocks.test.ts` |
| CREATE | `tests/unit/components/editor/BlockEditor.test.tsx` |
| CREATE | `tests/e2e/editor/block-editor.spec.ts` |

---

**Last Updated:** 2026-02-21
