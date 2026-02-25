# Story SKB-25.1: Page Favorites

**Epic:** Epic 25 - Page Favorites & Sharing
**Story ID:** SKB-25.1
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** None (first story)

---

## User Story

As a SymbioKnowledgeBase user, I want to mark pages as favorites using a star icon, and see my favorited pages in a dedicated "Favorites" section in the sidebar, So that I can quickly access the pages I use most without scrolling through the full page tree.

---

## Acceptance Criteria

### Star Button in Page Header
- [ ] A star icon button appears in the top-right of every page, next to the Export Markdown button
- [ ] Button order (left to right): Export Markdown, Favorite Star, (future: Share)
- [ ] When the page is NOT a favorite: star is outlined (empty), secondary text color
- [ ] When the page IS a favorite: star is filled (solid), accent/yellow color (`#f5c518` or `var(--favorite-star)`)
- [ ] Clicking the star toggles the favorite state
- [ ] Toggle uses optimistic update — star fills/unfills instantly before API response
- [ ] If the API call fails, the star reverts and an error toast is shown
- [ ] Star has a hover state: slight background highlight + tooltip ("Add to favorites" / "Remove from favorites")
- [ ] Star has a subtle scale animation on click (scale 1 → 1.2 → 1, 200ms)

### Favorites API
- [ ] `POST /api/pages/{id}/favorite` — Toggle favorite status
  - Body: `{ isFavorite: boolean }`
  - If `isFavorite: true`: creates a `PageFavorite` record for the current user
  - If `isFavorite: false`: deletes the `PageFavorite` record
  - Returns: `{ data: { pageId, isFavorite } }`
  - Validates: page exists and belongs to the user's tenant
- [ ] `GET /api/favorites` — List all favorite pages for the current user
  - Returns: `{ data: [{ id, title, icon, pageId, favoriteAt }] }`
  - Sorted by `favoriteAt` ascending (oldest favorites first, matching Notion)
  - Scoped to current tenant

### Database Model
- [ ] New `PageFavorite` model in Prisma:
  ```
  PageFavorite {
    id        String   @id @default(uuid())
    userId    String
    pageId    String
    tenantId  String
    createdAt DateTime @default(now())
    @@unique([userId, pageId])
    @@index([userId, tenantId])
  }
  ```
- [ ] Migration runs cleanly without data loss

### Sidebar Favorites Section
- [ ] A "Favorites" section appears in the sidebar between "Recents" and "Private"
- [ ] The section uses the same `SidebarTeamspaceSection` component as other sections
- [ ] The section icon is a filled star icon
- [ ] The section is collapsible (like all other sidebar sections)
- [ ] The section shows all favorited pages as a flat list (not nested — regardless of page hierarchy)
- [ ] Each favorite page shows: page icon (emoji or default) + page title
- [ ] Clicking a favorite page navigates to that page
- [ ] The section is hidden when the user has zero favorites (no empty state)
- [ ] When a page is unfavorited (via star or context menu), it disappears from the section immediately
- [ ] When a page is favorited, it appears in the section immediately (optimistic)

### Context Menu Integration
- [ ] The existing "Add to favorites" action in `PageContextMenu.tsx` (line 150-154) is wired to the real API
- [ ] When page is already a favorite, context menu shows "Remove from favorites" instead
- [ ] The context menu icon changes: outlined star → filled star when favorited

### Page Data Integration
- [ ] The `usePage(id)` hook response includes `isFavorite: boolean` for the current user
- [ ] The page list and page tree responses do NOT include favorite status (to avoid N+1 queries)
- [ ] Favorite status is fetched separately via `useFavorites()` hook

### Edge Cases
- [ ] Deleting a favorited page also removes it from favorites (cascade delete or handled in delete API)
- [ ] Pages moved to a different workspace are removed from favorites
- [ ] Multiple users can independently favorite the same page
- [ ] Favoriting a page in one tab reflects in another tab (React Query cache invalidation)

---

## Architecture Overview

```
Star Button Placement (PageHeader.tsx):
───────────────────────────────────────

┌──────────────────────────────────────────────────────────┐
│                                    [↓] [★] [Share]       │
│                                    Export Fav  (future)  │
│  📋 Page Title                                           │
│                                                          │
│  Page content...                                         │
└──────────────────────────────────────────────────────────┘

     ↓ Export: absolute right-4 top-2     (existing)
     ★ Favorite: right next to export     (new)
     Share: right next to favorite        (future SKB-25.2)

Button Row Layout:
  <div className="absolute right-4 top-2 z-10 flex items-center gap-1">
    <ExportButton />
    <FavoriteButton pageId={page.id} />
  </div>

Sidebar Section Order:
──────────────────────

┌─────────────────────────────┐
│ 🔍 Search                   │
│ 🏠 Home                     │
│                             │
│ ▸ Recents                   │  ← useRecentPages (localStorage)
│     Page A                  │
│     Page B                  │
│                             │
│ ▸ Favorites                 │  ← NEW: useFavorites (database)
│     ★ Page C                │
│     ★ Page D                │
│                             │
│ ▸ Private                   │  ← existing
│     Page E                  │
│     Page F                  │
│                             │
│ ▸ Teamspace 1              │  ← existing
│ ▸ Agent                    │  ← existing
└─────────────────────────────┘

API Flow:
─────────

User clicks ★ on page
        │
        ▼
FavoriteButton calls toggleFavorite(pageId, true)
        │
        ├── Optimistic: star fills yellow immediately
        ├── Optimistic: page appears in sidebar Favorites
        │
        ▼
POST /api/pages/{pageId}/favorite { isFavorite: true }
        │
        ├── Server creates PageFavorite record
        └── Returns { data: { pageId, isFavorite: true } }
        │
        ▼
React Query invalidates ["favorites"] cache
        │
        ▼
Sidebar re-renders with updated favorites list
```

---

## Implementation Steps

### Step 1: Add PageFavorite Model to Prisma

**File: `prisma/schema.prisma`** (modify)

```prisma
model PageFavorite {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  pageId    String   @map("page_id")
  tenantId  String   @map("tenant_id")
  createdAt DateTime @default(now()) @map("created_at")

  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([userId, pageId], map: "uq_page_favorite_user_page")
  @@index([userId, tenantId], map: "idx_page_favorite_user_tenant")
  @@map("page_favorites")
}
```

Also add the relation to the Page model:
```prisma
model Page {
  // ... existing fields
  favorites  PageFavorite[]
}
```

Run migration:
```bash
npx prisma migrate dev --name add-page-favorites
```

### Step 2: Create Favorite API Route

**File: `src/app/api/pages/[id]/favorite/route.ts`** (create)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withTenant, TenantContext } from "@/lib/api/withTenant";
import { prisma } from "@/lib/prisma";

// POST: Toggle favorite status
export const POST = withTenant(
  async (req: NextRequest, context: TenantContext, { params }: { params: { id: string } }) => {
    const { id: pageId } = await params;
    const { isFavorite } = await req.json();

    // Verify page exists in tenant
    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: context.tenantId },
    });
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    if (isFavorite) {
      // Upsert favorite
      await prisma.pageFavorite.upsert({
        where: { userId_pageId: { userId: context.userId, pageId } },
        create: { userId: context.userId, pageId, tenantId: context.tenantId },
        update: {},
      });
    } else {
      // Delete favorite (ignore if not exists)
      await prisma.pageFavorite.deleteMany({
        where: { userId: context.userId, pageId },
      });
    }

    return NextResponse.json({ data: { pageId, isFavorite } });
  }
);
```

**File: `src/app/api/favorites/route.ts`** (create)

```typescript
// GET: List all favorites for current user in current tenant
export const GET = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    const favorites = await prisma.pageFavorite.findMany({
      where: { userId: context.userId, tenantId: context.tenantId },
      include: { page: { select: { id: true, title: true, icon: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      data: favorites.map(f => ({
        id: f.id,
        pageId: f.page.id,
        title: f.page.title,
        icon: f.page.icon,
        favoriteAt: f.createdAt.toISOString(),
      })),
    });
  }
);
```

### Step 3: Create useFavorites Hook

**File: `src/hooks/useFavorites.ts`** (create)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const favoriteKeys = {
  all: ["favorites"] as const,
  list: () => [...favoriteKeys.all, "list"] as const,
};

interface FavoritePage {
  id: string;
  pageId: string;
  title: string;
  icon: string | null;
  favoriteAt: string;
}

export function useFavorites() {
  return useQuery<{ data: FavoritePage[] }>({
    queryKey: favoriteKeys.list(),
    queryFn: () => fetch("/api/favorites").then(r => r.json()),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, isFavorite }: { pageId: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/pages/${pageId}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    // Optimistic update
    onMutate: async ({ pageId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData(favoriteKeys.list());
      // Optimistically update favorites list
      // ... (add or remove from cache)
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.list() });
    },
  });
}

export function useIsFavorite(pageId: string): boolean {
  const { data } = useFavorites();
  return data?.data?.some(f => f.pageId === pageId) ?? false;
}
```

### Step 4: Create FavoriteButton Component

**File: `src/components/page/FavoriteButton.tsx`** (create)

```typescript
"use client";

import { Star } from "lucide-react";
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";

interface FavoriteButtonProps {
  pageId: string;
}

export function FavoriteButton({ pageId }: FavoriteButtonProps) {
  const isFavorite = useIsFavorite(pageId);
  const toggleFavorite = useToggleFavorite();

  const handleClick = () => {
    toggleFavorite.mutate({ pageId, isFavorite: !isFavorite });
  };

  return (
    <button
      onClick={handleClick}
      className={`
        rounded p-1.5 transition-all duration-200
        ${isFavorite
          ? "text-yellow-400 hover:text-yellow-500"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        }
        active:scale-125
      `}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
    >
      <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
    </button>
  );
}
```

### Step 5: Add FavoriteButton to PageHeader

**File: `src/components/workspace/PageHeader.tsx`** (modify)

Replace the single export button div with a button group:

```typescript
// BEFORE (line 111):
<div className="absolute right-4 top-2 z-10">
  <button onClick={handleExportMarkdown} ...>
    <Download className="h-4 w-4" />
  </button>
</div>

// AFTER:
<div className="absolute right-4 top-2 z-10 flex items-center gap-1">
  <button onClick={handleExportMarkdown} ...>
    <Download className="h-4 w-4" />
  </button>
  <FavoriteButton pageId={page.id} />
</div>
```

### Step 6: Add Favorites Section to Sidebar

**File: `src/components/workspace/Sidebar.tsx`** (modify)

Add the Favorites section between Recents (ends at ~line 243) and Private (starts at ~line 246):

```typescript
import { useFavorites } from "@/hooks/useFavorites";

// Inside the Sidebar component:
const { data: favoritesData } = useFavorites();
const favoritePages = favoritesData?.data ?? [];

// Between Recents and Private sections:
{favoritePages.length > 0 && (
  <SidebarTeamspaceSection
    sectionId="favorites"
    label="Favorites"
    icon={
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    }
    isLoading={false}
    error={null}
    tree={favoritePages.map(f => ({
      id: f.pageId,
      title: f.title,
      icon: f.icon,
      children: [],
      parentId: null,
      position: 0,
      teamspaceId: null,
      spaceType: "PRIVATE" as const,
    }))}
  />
)}
```

### Step 7: Wire Context Menu Favorite Action

**File: `src/components/sidebar/PageContextMenu.tsx`** (modify)

Replace the stub at lines 150-154:

```typescript
// Import hook
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";

// Inside component:
const isFavorite = useIsFavorite(pageId);
const toggleFavorite = useToggleFavorite();

// Update menu item (line ~34):
{ icon: Star, label: isFavorite ? "Remove from favorites" : "Add to favorites", action: "favorite", divider: true },

// Replace case (line ~150):
case "favorite":
  toggleFavorite.mutate({ pageId, isFavorite: !isFavorite });
  onClose();
  break;
```

---

## Testing Requirements

### Unit Tests (10+ cases)

**File: `src/__tests__/components/page/FavoriteButton.test.tsx`**

- Renders outlined star when page is not favorited
- Renders filled yellow star when page is favorited
- Clicking star calls toggleFavorite mutation
- Has correct aria-label for favorited state
- Has correct aria-label for unfavorited state
- Has aria-pressed attribute matching favorite state
- Shows tooltip on hover ("Add to favorites" / "Remove from favorites")

**File: `src/__tests__/hooks/useFavorites.test.ts`**

- useFavorites returns favorite pages from API
- useToggleFavorite calls POST /api/pages/{id}/favorite
- useIsFavorite returns true for favorited page
- useIsFavorite returns false for non-favorited page
- Optimistic update: star toggles before API responds

### Integration Tests (8+ cases)

**File: `src/__tests__/integration/favorites.test.tsx`**

- POST /api/pages/{id}/favorite with isFavorite=true creates PageFavorite record
- POST /api/pages/{id}/favorite with isFavorite=false deletes PageFavorite record
- POST /api/pages/{id}/favorite for non-existent page returns 404
- GET /api/favorites returns all favorites for current user
- GET /api/favorites returns empty array when no favorites
- Favorites are scoped to current tenant (different tenant, different favorites)
- Deleting a page cascades to PageFavorite deletion
- Sidebar Favorites section appears when favorites exist, hidden when empty

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/favorites.test.ts`**

- Click star on page → star fills yellow → page appears in sidebar Favorites
- Click filled star → star unfills → page disappears from sidebar Favorites
- Right-click page in sidebar → "Add to favorites" → star fills + sidebar updates
- Navigate to different page → star state reflects that page's favorite status

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add PageFavorite model |
| `src/app/api/pages/[id]/favorite/route.ts` | Create | Toggle favorite API |
| `src/app/api/favorites/route.ts` | Create | List favorites API |
| `src/hooks/useFavorites.ts` | Create | Favorites hooks (list, toggle, check) |
| `src/components/page/FavoriteButton.tsx` | Create | Star toggle button component |
| `src/components/workspace/PageHeader.tsx` | Modify | Add FavoriteButton to header button row |
| `src/components/workspace/Sidebar.tsx` | Modify | Add Favorites section between Recents and Private |
| `src/components/sidebar/PageContextMenu.tsx` | Modify | Wire favorite action (replace stub at line 150) |
| `src/types/page.ts` | Possibly Modify | Add FavoritePage type if needed |
| Tests | Create | Unit, integration, E2E tests |

---

## Reference: Current File Locations

| Element | File | Line(s) | Current Value |
|---------|------|---------|---------------|
| Export button container | `PageHeader.tsx` | 111 | `absolute right-4 top-2 z-10` (single button) |
| Context menu favorite stub | `PageContextMenu.tsx` | 150-154 | `console.log("Toggle favorite:", pageId)` |
| Context menu favorite item | `PageContextMenu.tsx` | 34 | `{ icon: Star, label: "Add to favorites", action: "favorite" }` |
| Sidebar Recents section end | `Sidebar.tsx` | ~243 | End of recents `SidebarTeamspaceSection` |
| Sidebar Private section start | `Sidebar.tsx` | ~246 | Start of private `SidebarTeamspaceSection` |
| useRecentPages hook | `useRecentPages.ts` | 1-99 | localStorage-based, pattern to follow |

---

**Last Updated:** 2026-02-25
