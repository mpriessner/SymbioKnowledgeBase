# Story SKB-25.3: Publish to Web

**Epic:** Epic 25 - Page Favorites & Sharing
**Story ID:** SKB-25.3
**Story Points:** 6 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-25.2 (Publish tab lives inside the Share dialog)

---

## User Story

As a SymbioKnowledgeBase user, I want to publish a page to the web so that anyone with the public URL can view it, and I want to control whether search engines can index the published page, So that I can share knowledge publicly without requiring the reader to have an account.

---

## Acceptance Criteria

### Publish Tab in Share Dialog
- [ ] The "Publish" tab in the Share dialog (created in SKB-25.2) shows the publish controls
- [ ] Tab content includes:
  - A prominent toggle: "Publish to web"
  - When off: explanatory text "Share this page with anyone on the internet"
  - When on: published URL displayed, copy button, and additional options
- [ ] Toggle switch has smooth animation (200ms)

### Publishing a Page
- [ ] Toggling "Publish to web" ON:
  - Calls the publish API
  - Generates (or reuses) a public URL: `/public/{shareToken}`
  - Shows the published URL in a read-only input with a "Copy" button
  - Shows a success toast: "Page published"
- [ ] Toggling "Publish to web" OFF:
  - Calls the unpublish API
  - Revokes the public link (sets `revokedAt` on PublicShareLink)
  - Shows a success toast: "Page unpublished"
  - The URL becomes inaccessible (returns 404)

### Published URL Format
- [ ] URL format: `{baseUrl}/public/{shareToken}` where `shareToken` is a unique, URL-safe string
- [ ] Share token is generated using a cryptographically random string (e.g., `nanoid` or `crypto.randomUUID()`)
- [ ] The same page republished gets a NEW token (old token stays revoked)
- [ ] URL is displayed in a read-only text field with monospace font

### Additional Options (When Published)
- [ ] "Allow search engine indexing" toggle (default: OFF)
  - When ON: public page includes `<meta name="robots" content="index, follow">`
  - When OFF: public page includes `<meta name="robots" content="noindex, nofollow">`
- [ ] "Allow duplicate as template" toggle (default: OFF, placeholder for future — disabled with "Coming soon" label)
- [ ] Last published timestamp: "Published on Feb 25, 2026" (or relative: "Published 2 hours ago")

### Public Page Rendering
- [ ] Visiting `/public/{shareToken}` renders the page content in a read-only view
- [ ] The public view:
  - Shows the page title and icon
  - Renders all block content (headings, text, code blocks, images, etc.)
  - Does NOT show the editor (no editing controls, no slash commands)
  - Does NOT show the sidebar, navigation, or workspace elements
  - Has a minimal header: page title + "Built with SymbioKnowledgeBase" link
  - Has proper `<meta>` tags for SEO (title, description from first paragraph)
  - Has Open Graph tags for social media previews (og:title, og:description, og:image)
- [ ] The public view supports both light and dark themes (auto-detects user preference)
- [ ] The public view is responsive (works on mobile)

### Extending PublicShareLink Model
- [ ] The existing `PublicShareLink` model in Prisma (`schema.prisma:359-379`) is extended:
  ```
  PublicShareLink {
    // existing fields...
    allowIndexing  Boolean  @default(false)
    publishedAt    DateTime?
  }
  ```
- [ ] If the model already has sufficient fields, reuse them; avoid creating a duplicate model

### Publish API
- [ ] `POST /api/pages/{id}/publish` — Publish the page
  - Creates or reuses a PublicShareLink record
  - Sets `revokedAt = null` if re-publishing a previously revoked link
  - Returns: `{ data: { shareToken, url, publishedAt, allowIndexing } }`
- [ ] `DELETE /api/pages/{id}/publish` — Unpublish the page
  - Sets `revokedAt = now()` on the PublicShareLink
  - Returns: 204 No Content
- [ ] `PATCH /api/pages/{id}/publish` — Update publish options
  - Body: `{ allowIndexing: boolean }`
  - Returns: `{ data: { allowIndexing } }`
- [ ] `GET /api/public/{shareToken}` — Serve the public page
  - Returns: page data in JSON (for client-side rendering) or server-rendered HTML
  - Returns 404 if token is invalid or link is revoked
  - Returns 404 if link is expired (if `expiresAt` is set and passed)

### Access Control
- [ ] Only the page owner or users with "Full access" can publish/unpublish
- [ ] Published pages are readable by anyone (no authentication required)
- [ ] The public API route does NOT require authentication

### Error Handling
- [ ] Publish without permission: 403 "You don't have permission to publish this page"
- [ ] Access revoked public link: 404 "This page is no longer published"
- [ ] API failure on publish: error toast "Failed to publish page. Try again."

---

## Architecture Overview

```
Publish Tab Content:
────────────────────

UNPUBLISHED STATE:
┌──────────────────────────────────────────────┐
│  Share  │ Publish │                          │
│         └─────────┘                          │
│                                              │
│  Publish to web                    [○ OFF]   │
│  Share this page with anyone on               │
│  the internet.                               │
│                                              │
└──────────────────────────────────────────────┘

PUBLISHED STATE:
┌──────────────────────────────────────────────┐
│  Share  │ Publish │                          │
│         └─────────┘                          │
│                                              │
│  Publish to web                    [● ON ]   │
│                                              │
│  ┌────────────────────────────────┐ ┌──────┐│
│  │ symbio.app/public/abc123...    │ │ Copy ││
│  └────────────────────────────────┘ └──────┘│
│                                              │
│  Allow search engine indexing      [○ OFF]   │
│  Allow duplicate as template       [○ OFF]   │
│                     (Coming soon)            │
│                                              │
│  Published on Feb 25, 2026                   │
└──────────────────────────────────────────────┘

Public Page Route:
──────────────────

Browser visits: /public/abc123def456
        │
        ▼
GET /api/public/abc123def456
        │
        ├── Lookup PublicShareLink by shareToken
        ├── Check: not revoked, not expired
        ├── Fetch Page + block content
        └── Return page data
        │
        ▼
Public page component renders:
┌──────────────────────────────────────────────────────────┐
│  📋 SciSymbio Platform Architecture                      │
│                                                          │
│  Master Document for die SciSymbio Platform...           │
│                                                          │
│  1. Vision & Überblick                                   │
│  1.1 Core Principles                                     │
│  ...                                                     │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  Built with SymbioKnowledgeBase                          │
└──────────────────────────────────────────────────────────┘

Database (extending existing PublicShareLink):
──────────────────────────────────────────────

model PublicShareLink {
  id             String    @id @default(uuid())
  pageId         String    @map("page_id")
  tenantId       String    @map("tenant_id")
  shareToken     String    @unique @map("share_token")
  createdBy      String    @map("created_by")
  allowIndexing  Boolean   @default(false) @map("allow_indexing")   // NEW
  publishedAt    DateTime? @map("published_at")                     // NEW
  expiresAt      DateTime? @map("expires_at")
  revokedAt      DateTime? @map("revoked_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  page           Page      @relation(fields: [pageId], references: [id], onDelete: Cascade)
  @@map("public_share_links")
}
```

---

## Implementation Steps

### Step 1: Update PublicShareLink Model

**File: `prisma/schema.prisma`** (modify)

Add new fields to the existing PublicShareLink model:

```prisma
model PublicShareLink {
  // ... existing fields
  allowIndexing  Boolean   @default(false) @map("allow_indexing")
  publishedAt    DateTime? @map("published_at")
}
```

Run migration:
```bash
npx prisma migrate dev --name update-public-share-link-publish
```

### Step 2: Create Publish API Routes

**File: `src/app/api/pages/[id]/publish/route.ts`** (create)

```typescript
// POST: Publish page (create/reactivate public link)
export const POST = withTenant(async (req, context, { params }) => {
  const { id: pageId } = await params;

  // Verify page exists and user has Full access or is owner
  // Check for existing non-revoked link — reuse if exists
  // Otherwise, create new PublicShareLink with random shareToken
  // Set publishedAt = now(), revokedAt = null
  // Return: { shareToken, url, publishedAt, allowIndexing }
});

// DELETE: Unpublish page
export const DELETE = withTenant(async (req, context, { params }) => {
  const { id: pageId } = await params;

  // Find active PublicShareLink for this page
  // Set revokedAt = now()
  // Return 204
});

// PATCH: Update publish options
export const PATCH = withTenant(async (req, context, { params }) => {
  const { id: pageId } = await params;
  const { allowIndexing } = await req.json();

  // Update PublicShareLink.allowIndexing
  // Return updated options
});
```

### Step 3: Create Public Page Route

**File: `src/app/public/[token]/page.tsx`** (create)

```typescript
// Server component that fetches and renders the published page

export async function generateMetadata({ params }) {
  // Fetch page data
  // Return: title, description, robots (index/noindex), Open Graph tags
}

export default async function PublicPage({ params }) {
  const { token } = await params;

  // Fetch public page via API or directly from DB
  // Render read-only page view
  // Minimal layout: no sidebar, no editor, no workspace chrome
}
```

**File: `src/components/page/PublicPageView.tsx`** (create)

```typescript
// Read-only page renderer
// Renders TipTap content as static HTML (no editor)
// Shows title, icon, blocks
// Footer: "Built with SymbioKnowledgeBase"
```

### Step 4: Create Publish Hook

**File: `src/hooks/usePublish.ts`** (create)

```typescript
export function usePublishStatus(pageId: string) {
  // Query: check if page has an active PublicShareLink
  // Returns: { isPublished, shareToken, url, publishedAt, allowIndexing }
}

export function usePublishPage() {
  // Mutation: POST /api/pages/{id}/publish
}

export function useUnpublishPage() {
  // Mutation: DELETE /api/pages/{id}/publish
}

export function useUpdatePublishOptions() {
  // Mutation: PATCH /api/pages/{id}/publish
}
```

### Step 5: Create ShareDialogPublish Component

**File: `src/components/page/ShareDialogPublish.tsx`** (create)

```typescript
"use client";

import { usePublishStatus, usePublishPage, useUnpublishPage, useUpdatePublishOptions } from "@/hooks/usePublish";

interface ShareDialogPublishProps {
  pageId: string;
}

export function ShareDialogPublish({ pageId }: ShareDialogPublishProps) {
  const { isPublished, url, publishedAt, allowIndexing } = usePublishStatus(pageId);
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const updateOptions = useUpdatePublishOptions();

  const handleTogglePublish = () => {
    if (isPublished) {
      unpublishPage.mutate({ pageId });
    } else {
      publishPage.mutate({ pageId });
    }
  };

  return (
    <div className="space-y-4">
      {/* Publish toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Publish to web</p>
          {!isPublished && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Share this page with anyone on the internet.
            </p>
          )}
        </div>
        <ToggleSwitch checked={isPublished} onChange={handleTogglePublish} />
      </div>

      {/* Published options (only when published) */}
      {isPublished && (
        <>
          {/* URL with Copy button */}
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 rounded border border-[var(--border-default)] px-3 py-1.5
                         text-xs font-mono bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
            />
            <CopyButton text={url} />
          </div>

          {/* Options toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)]">
                Allow search engine indexing
              </span>
              <ToggleSwitch
                checked={allowIndexing}
                onChange={(v) => updateOptions.mutate({ pageId, allowIndexing: v })}
              />
            </div>
            <div className="flex items-center justify-between opacity-50">
              <div>
                <span className="text-sm text-[var(--text-primary)]">
                  Allow duplicate as template
                </span>
                <span className="ml-2 text-[10px] bg-[var(--bg-secondary)] rounded px-1.5 py-0.5 text-[var(--text-tertiary)]">
                  Coming soon
                </span>
              </div>
              <ToggleSwitch checked={false} disabled onChange={() => {}} />
            </div>
          </div>

          {/* Published timestamp */}
          <p className="text-xs text-[var(--text-tertiary)]">
            Published on {new Date(publishedAt).toLocaleDateString()}
          </p>
        </>
      )}
    </div>
  );
}
```

### Step 6: Wire Publish Tab into ShareDialog

**File: `src/components/page/ShareDialog.tsx`** (modify — from SKB-25.2)

Replace the placeholder publish tab content:

```typescript
{activeTab === "publish" && (
  <div className="p-4">
    <ShareDialogPublish pageId={pageId} />
  </div>
)}
```

---

## Testing Requirements

### Unit Tests (10+ cases)

**File: `src/__tests__/components/page/ShareDialogPublish.test.tsx`**

- Renders "Publish to web" toggle in OFF state when unpublished
- Renders published URL and options when published
- Toggle calls publish API when turning ON
- Toggle calls unpublish API when turning OFF
- Copy button copies URL to clipboard
- Allow indexing toggle calls update API
- Duplicate as template toggle is disabled
- Published date displays correctly

**File: `src/__tests__/components/page/PublicPageView.test.tsx`**

- Renders page title and icon
- Renders block content as static HTML
- Does NOT render editor controls
- Shows footer with "Built with SymbioKnowledgeBase"
- Includes correct meta tags

### Integration Tests (8+ cases)

**File: `src/__tests__/integration/publish.test.tsx`**

- POST /api/pages/{id}/publish creates PublicShareLink
- POST /api/pages/{id}/publish returns valid share token and URL
- DELETE /api/pages/{id}/publish sets revokedAt
- GET /api/public/{token} returns page data for valid token
- GET /api/public/{token} returns 404 for revoked token
- GET /api/public/{token} returns 404 for invalid token
- PATCH /api/pages/{id}/publish updates allowIndexing
- Non-owner with Can view permission cannot publish (403)

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/publish.test.ts`**

- Share dialog → Publish tab → toggle ON → URL appears → copy URL
- Visit public URL → page content visible → no editor, no sidebar
- Unpublish → visit same URL → 404 page
- Toggle search engine indexing → check meta robots tag on public page

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `allowIndexing`, `publishedAt` to PublicShareLink |
| `src/app/api/pages/[id]/publish/route.ts` | Create | POST publish, DELETE unpublish, PATCH update options |
| `src/app/api/public/[token]/route.ts` | Create | GET public page data (no auth) |
| `src/app/public/[token]/page.tsx` | Create | Public page server component |
| `src/components/page/PublicPageView.tsx` | Create | Read-only page renderer |
| `src/components/page/ShareDialogPublish.tsx` | Create | Publish tab content |
| `src/components/page/ToggleSwitch.tsx` | Create | Reusable toggle switch component |
| `src/hooks/usePublish.ts` | Create | Publish hooks (status, publish, unpublish, update) |
| `src/components/page/ShareDialog.tsx` | Modify | Replace publish placeholder with real component |
| Tests | Create | Unit, integration, E2E tests |

---

## Reference: Existing PublicShareLink Model

**File:** `prisma/schema.prisma` (lines 359-379)

The existing model provides the foundation. New fields (`allowIndexing`, `publishedAt`) extend it without breaking existing functionality.

---

**Last Updated:** 2026-02-25
