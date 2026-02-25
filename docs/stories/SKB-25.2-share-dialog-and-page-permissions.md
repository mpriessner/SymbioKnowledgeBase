# Story SKB-25.2: Share Dialog & Page Permissions

**Epic:** Epic 25 - Page Favorites & Sharing
**Story ID:** SKB-25.2
**Story Points:** 13 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-25.1 (share button sits next to favorite star in header)

---

## User Story

As a SymbioKnowledgeBase user, I want to share pages with other workspace members by email and control their access level (Full access, Can edit, Can comment, Can view), So that I can collaborate with my team while maintaining appropriate access controls for each page.

---

## Acceptance Criteria

### Share Button in Page Header
- [ ] A "Share" button appears in the top-right of every page, next to the Favorite star
- [ ] Button order (left to right): Export Markdown, Favorite Star, Share
- [ ] "Share" button style: text button with border, matches Notion's styling
- [ ] Button text: "Share" (not just an icon)
- [ ] Clicking "Share" opens the Share dialog
- [ ] Button has hover state: darker border + slight background

### Share Dialog — Layout
- [ ] Dialog opens as a popover/dropdown anchored to the Share button (not a full-page modal)
- [ ] Dialog has two tabs: "Share" and "Publish" (Publish is built in SKB-25.3, but tab header exists now)
- [ ] Dialog width: ~440px
- [ ] Dialog has a subtle shadow and border matching the dropdown pattern
- [ ] Clicking outside the dialog closes it
- [ ] Pressing Escape closes the dialog
- [ ] Dialog is keyboard-navigable (Tab through elements)

### Share Tab — Invite Section
- [ ] Email input at top: placeholder "Email or group, separated by commas"
- [ ] "Invite" button next to the input (blue/accent color, disabled when input is empty)
- [ ] Typing a valid email and clicking Invite:
  - Sends an invitation to share the page with that email
  - If the email matches an existing workspace member: creates a `PageShare` record immediately
  - If the email does NOT match any workspace member: shows an info message "User not found in this workspace. They must be a workspace member to access shared pages."
- [ ] Multiple emails can be entered, separated by commas
- [ ] Basic email validation (shows inline error for invalid format)
- [ ] After successful invite: input clears, new member appears in the list below

### Share Tab — Member List
- [ ] Shows all users who have access to this page
- [ ] Each member row shows:
  - Avatar initial (colored circle with first letter of name/email)
  - Full name (or email if name not available)
  - Email address (secondary text)
  - Permission dropdown
- [ ] The page owner (creator) shows "Full access" and cannot be changed or removed
- [ ] The page owner row shows "(You)" next to the name if viewing as owner
- [ ] Other members show their permission level in a dropdown

### Share Tab — Permission Levels
- [ ] Permission dropdown options (matching Notion):
  - **Full access** — "Edit, comment, and share" (description below label)
  - **Can edit** — "Edit and comment"
  - **Can comment** — "Comment only"
  - **Can view** — "View only"
  - Divider
  - **Remove** — "Remove access" (danger/red styling, with trash icon)
- [ ] Changing a permission: calls API to update the `PageShare` record
- [ ] Removing a member: calls API to delete the `PageShare` record, member disappears from list
- [ ] Current user with "Full access" can see and use the "Remove" option for others
- [ ] Users cannot remove themselves from a page they own

### Share Tab — General Access
- [ ] "General access" section below the member list
- [ ] Lock icon + dropdown with options:
  - **Only people invited** — "Only people you've shared with can access" (default)
  - **Anyone with the link** — "Anyone in this workspace with the link can view"
- [ ] Changing general access updates a field on the Page or a separate config
- [ ] When "Anyone with the link" is selected, any workspace member can access the page via URL

### Share Tab — Footer
- [ ] "Copy link" button at bottom-right: copies the page URL to clipboard
- [ ] After copying: button text changes to "Copied!" for 2 seconds, then reverts
- [ ] Optional: "Learn about sharing" link (can link to docs or be a placeholder)

### Data Model — PageShare
- [ ] New `PageShare` model in Prisma:
  ```
  PageShare {
    id          String     @id @default(uuid())
    pageId      String
    userId      String
    tenantId    String
    permission  Permission (FULL_ACCESS | CAN_EDIT | CAN_COMMENT | CAN_VIEW)
    sharedBy    String     (userId of the person who shared)
    createdAt   DateTime
    updatedAt   DateTime
    @@unique([pageId, userId])
  }
  ```
- [ ] New `Permission` enum: `FULL_ACCESS`, `CAN_EDIT`, `CAN_COMMENT`, `CAN_VIEW`
- [ ] Page model extended with `generalAccess` field: `INVITED_ONLY` (default) | `ANYONE_WITH_LINK`

### Share API
- [ ] `GET /api/pages/{id}/share` — List all shares for a page
  - Returns: `{ data: [{ id, userId, userName, userEmail, permission, sharedBy, createdAt }] }`
  - Includes the page owner as a virtual entry with `permission: "FULL_ACCESS"`
  - Only accessible to users with Full access or page owner
- [ ] `POST /api/pages/{id}/share` — Add a new share
  - Body: `{ email: string, permission: Permission }`
  - Looks up user by email within the tenant
  - Creates `PageShare` record
  - Returns: `{ data: { id, userId, permission } }` with 201 status
  - Error if user not found in workspace: 404
  - Error if user already has access: 409
- [ ] `PATCH /api/pages/{id}/share/{shareId}` — Update permission
  - Body: `{ permission: Permission }`
  - Returns: `{ data: { id, permission } }`
  - Error if trying to change owner's permission: 403
- [ ] `DELETE /api/pages/{id}/share/{shareId}` — Remove access
  - Returns: 204 No Content
  - Error if trying to remove owner: 403
- [ ] `PATCH /api/pages/{id}/access` — Update general access level
  - Body: `{ generalAccess: "INVITED_ONLY" | "ANYONE_WITH_LINK" }`
  - Returns: `{ data: { generalAccess } }`

### Access Control
- [ ] When a user tries to view a shared page, the API checks:
  1. Is the user the page owner? → Full access
  2. Does a `PageShare` record exist for this user + page? → Use that permission
  3. Is `generalAccess` set to `ANYONE_WITH_LINK` and user is in the same tenant? → Can view
  4. Otherwise → 403 Forbidden
- [ ] Permission hierarchy: Full access > Can edit > Can comment > Can view
- [ ] "Can view" users: can read page content, cannot edit
- [ ] "Can comment" users: can view + add comments (comments are future scope, but permission is defined now)
- [ ] "Can edit" users: can view + edit page content
- [ ] "Full access" users: can view + edit + share with others + change permissions

### Error Handling
- [ ] Invite non-existent email: "User not found in this workspace"
- [ ] Invite already-shared user: "This user already has access to this page"
- [ ] Remove page owner: "Cannot remove the page owner"
- [ ] Change owner permission: "Cannot change the owner's access level"
- [ ] API failure: error toast with message

---

## Architecture Overview

```
Share Dialog Component Tree:
────────────────────────────

ShareButton (in PageHeader)
    │
    ▼
ShareDialog (popover, anchored to button)
    │
    ├── Tab: "Share" (active by default)
    │   │
    │   ├── ShareDialogInvite
    │   │   └── Email input + Invite button
    │   │
    │   ├── ShareDialogMemberList
    │   │   └── MemberRow × N
    │   │       └── PermissionDropdown
    │   │
    │   ├── ShareDialogGeneralAccess
    │   │   └── Access level dropdown
    │   │
    │   └── ShareDialogFooter
    │       └── Copy link button
    │
    └── Tab: "Publish" (SKB-25.3)
        └── PublishTabContent

Permission Dropdown (Notion-style):
────────────────────────────────────

┌──────────────────────────────────┐
│ Current access                   │
│ Full access                      │
│ via user access on Workspace     │
│ ──────────────────────────────── │
│ User access                      │
│                                  │
│ Full access                   ✓  │
│ Edit, comment, and share         │
│                                  │
│ Can edit                         │
│ Edit and comment                 │
│                                  │
│ Can comment                      │
│ Comment only                     │
│                                  │
│ Can view                         │
│ View only                        │
│ ──────────────────────────────── │
│ 🗑 Remove                        │
└──────────────────────────────────┘

Database Schema:
────────────────

enum Permission {
  FULL_ACCESS
  CAN_EDIT
  CAN_COMMENT
  CAN_VIEW
}

enum GeneralAccess {
  INVITED_ONLY
  ANYONE_WITH_LINK
}

model PageShare {
  id          String     @id @default(uuid())
  pageId      String     @map("page_id")
  userId      String     @map("user_id")
  tenantId    String     @map("tenant_id")
  permission  Permission @default(CAN_VIEW)
  sharedBy    String     @map("shared_by")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  page        Page       @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([pageId, userId], map: "uq_page_share_page_user")
  @@index([userId, tenantId], map: "idx_page_share_user_tenant")
  @@map("page_shares")
}

model Page {
  // ... existing fields
  generalAccess  GeneralAccess @default(INVITED_ONLY) @map("general_access")
  shares         PageShare[]
}

API Routes:
───────────

GET    /api/pages/{id}/share           → List all shares + owner
POST   /api/pages/{id}/share           → Add new share (by email)
PATCH  /api/pages/{id}/share/{shareId} → Update permission
DELETE /api/pages/{id}/share/{shareId} → Remove access
PATCH  /api/pages/{id}/access          → Update general access
```

---

## Implementation Steps

### Step 1: Update Database Schema

**File: `prisma/schema.prisma`** (modify)

Add the Permission enum, GeneralAccess enum, PageShare model, and update Page model:

```prisma
enum Permission {
  FULL_ACCESS
  CAN_EDIT
  CAN_COMMENT
  CAN_VIEW
}

enum GeneralAccess {
  INVITED_ONLY
  ANYONE_WITH_LINK
}

model PageShare {
  id          String     @id @default(uuid())
  pageId      String     @map("page_id")
  userId      String     @map("user_id")
  tenantId    String     @map("tenant_id")
  permission  Permission @default(CAN_VIEW)
  sharedBy    String     @map("shared_by")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  page        Page       @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([pageId, userId], map: "uq_page_share_page_user")
  @@index([userId, tenantId], map: "idx_page_share_user_tenant")
  @@map("page_shares")
}

// Add to Page model:
model Page {
  // ... existing fields
  generalAccess  GeneralAccess @default(INVITED_ONLY) @map("general_access")
  shares         PageShare[]
}
```

Run migration:
```bash
npx prisma migrate dev --name add-page-shares
```

### Step 2: Create Share API Routes

**File: `src/app/api/pages/[id]/share/route.ts`** (create)

```typescript
// GET: List all shares for a page
// POST: Add a new share (invite by email)

export const GET = withTenant(async (req, context, { params }) => {
  const { id: pageId } = await params;

  // Verify page exists and user has access
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId: context.tenantId },
    include: { shares: { include: { /* user details */ } } },
  });

  if (!page) return notFound();

  // Build member list: owner + shared users
  // Return with user name, email, permission, etc.
});

export const POST = withTenant(async (req, context, { params }) => {
  const { id: pageId } = await params;
  const { email, permission } = await req.json();

  // Look up user by email in the same tenant
  // Create PageShare record
  // Return new share entry
});
```

**File: `src/app/api/pages/[id]/share/[shareId]/route.ts`** (create)

```typescript
// PATCH: Update permission level
// DELETE: Remove access

export const PATCH = withTenant(async (req, context, { params }) => {
  // Validate not changing owner permission
  // Update PageShare.permission
});

export const DELETE = withTenant(async (req, context, { params }) => {
  // Validate not removing owner
  // Delete PageShare record
});
```

**File: `src/app/api/pages/[id]/access/route.ts`** (create)

```typescript
// PATCH: Update general access level
export const PATCH = withTenant(async (req, context, { params }) => {
  const { generalAccess } = await req.json();
  // Update Page.generalAccess
});
```

### Step 3: Create usePageShares Hook

**File: `src/hooks/usePageShares.ts`** (create)

```typescript
export function usePageShares(pageId: string) {
  // Query: GET /api/pages/{id}/share
  // Returns: { shares, isLoading, error }
}

export function useInviteToPage() {
  // Mutation: POST /api/pages/{id}/share
  // Invalidates shares query on success
}

export function useUpdateSharePermission() {
  // Mutation: PATCH /api/pages/{id}/share/{shareId}
  // Optimistic update for permission change
}

export function useRemoveShare() {
  // Mutation: DELETE /api/pages/{id}/share/{shareId}
  // Optimistic removal from list
}

export function useUpdateGeneralAccess() {
  // Mutation: PATCH /api/pages/{id}/access
}
```

### Step 4: Create ShareButton Component

**File: `src/components/page/ShareButton.tsx`** (create)

```typescript
"use client";

import { useState, useRef } from "react";
import { ShareDialog } from "./ShareDialog";

interface ShareButtonProps {
  pageId: string;
  pageTitle: string;
}

export function ShareButton({ pageId, pageTitle }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="rounded px-3 py-1 text-sm font-medium
                   border border-[var(--border-default)]
                   text-[var(--text-primary)]
                   hover:bg-[var(--bg-secondary)]
                   hover:border-[var(--border-strong)]
                   transition-colors"
      >
        Share
      </button>
      {isOpen && (
        <ShareDialog
          pageId={pageId}
          pageTitle={pageTitle}
          anchorRef={buttonRef}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

### Step 5: Create ShareDialog Component

**File: `src/components/page/ShareDialog.tsx`** (create)

```typescript
"use client";

import { useState } from "react";
import { ShareDialogInvite } from "./ShareDialogInvite";
import { ShareDialogMemberList } from "./ShareDialogMemberList";
import { ShareDialogGeneralAccess } from "./ShareDialogGeneralAccess";

interface ShareDialogProps {
  pageId: string;
  pageTitle: string;
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
}

export function ShareDialog({ pageId, pageTitle, anchorRef, onClose }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<"share" | "publish">("share");

  return (
    // Popover positioned relative to anchor
    // Click outside to close
    // Escape to close
    <div className="absolute right-0 top-10 z-50 w-[440px] rounded-lg
                    bg-[var(--bg-primary)] border border-[var(--border-default)]
                    shadow-lg">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-default)] px-4 pt-3">
        <button
          className={`pb-2 px-1 mr-4 text-sm font-medium border-b-2 transition-colors
            ${activeTab === "share"
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)]"}`}
          onClick={() => setActiveTab("share")}
        >
          Share
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors
            ${activeTab === "publish"
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)]"}`}
          onClick={() => setActiveTab("publish")}
        >
          Publish
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "share" && (
        <div className="p-4">
          <ShareDialogInvite pageId={pageId} />
          <ShareDialogMemberList pageId={pageId} />
          <ShareDialogGeneralAccess pageId={pageId} />
          {/* Footer with Copy link */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-default)]">
            <button className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Learn about sharing
            </button>
            <CopyLinkButton pageId={pageId} />
          </div>
        </div>
      )}

      {activeTab === "publish" && (
        <div className="p-4 text-sm text-[var(--text-secondary)]">
          {/* Placeholder — implemented in SKB-25.3 */}
          Publishing is coming soon.
        </div>
      )}
    </div>
  );
}
```

### Step 6: Create Sub-Components

**File: `src/components/page/ShareDialogInvite.tsx`** (create)
- Email input with comma separation
- Invite button (accent/blue)
- Email validation

**File: `src/components/page/ShareDialogMemberList.tsx`** (create)
- Avatar + name + email for each member
- PermissionDropdown for each member
- Owner row marked "(You)" if applicable

**File: `src/components/page/PermissionDropdown.tsx`** (create)
- Dropdown with permission options matching Notion's layout
- Current permission highlighted with checkmark
- "Remove" option at bottom with danger styling
- Description text under each permission level

**File: `src/components/page/ShareDialogGeneralAccess.tsx`** (create)
- Lock icon + access level dropdown
- "Only people invited" (default) / "Anyone with the link"

### Step 7: Add ShareButton to PageHeader

**File: `src/components/workspace/PageHeader.tsx`** (modify)

```typescript
// Update the button group:
<div className="absolute right-4 top-2 z-10 flex items-center gap-1">
  <button onClick={handleExportMarkdown} ...>
    <Download className="h-4 w-4" />
  </button>
  <FavoriteButton pageId={page.id} />
  <ShareButton pageId={page.id} pageTitle={page.title} />
</div>
```

---

## Testing Requirements

### Unit Tests (15+ cases)

**File: `src/__tests__/components/page/ShareDialog.test.tsx`**

- Dialog renders with Share and Publish tabs
- Share tab is active by default
- Clicking Publish tab switches content
- Dialog closes on Escape
- Dialog closes on outside click

**File: `src/__tests__/components/page/ShareDialogInvite.test.tsx`**

- Email input renders with placeholder
- Invite button disabled when input empty
- Invite button enabled with valid email
- Invalid email shows validation error
- Multiple emails accepted (comma separated)

**File: `src/__tests__/components/page/PermissionDropdown.test.tsx`**

- Renders all 4 permission levels
- Current permission shows checkmark
- "Remove" option shows at bottom
- Clicking a permission calls onChange
- Owner row has no Remove option

**File: `src/__tests__/components/page/ShareDialogMemberList.test.tsx`**

- Renders owner as first entry
- Shows "(You)" for current user
- Each member has avatar, name, email
- Permission dropdown works for each member

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/page-sharing.test.tsx`**

- POST /api/pages/{id}/share creates PageShare record
- POST /api/pages/{id}/share with unknown email returns 404
- POST /api/pages/{id}/share with duplicate user returns 409
- GET /api/pages/{id}/share returns owner + shared users
- PATCH /api/pages/{id}/share/{shareId} updates permission
- PATCH /api/pages/{id}/share/{shareId} for owner returns 403
- DELETE /api/pages/{id}/share/{shareId} removes access
- DELETE /api/pages/{id}/share/{shareId} for owner returns 403
- PATCH /api/pages/{id}/access updates general access
- User with "Can view" cannot edit page content via API

### E2E Tests (5+ cases)

**File: `src/__tests__/e2e/page-sharing.test.ts`**

- Click Share → dialog opens → invite email → member appears in list
- Change member permission → dropdown updates → API called
- Remove member → disappears from list
- Copy link → clipboard contains page URL
- Set "Anyone with the link" → another workspace user can access page

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add Permission enum, GeneralAccess enum, PageShare model, update Page |
| `src/app/api/pages/[id]/share/route.ts` | Create | GET list shares, POST invite |
| `src/app/api/pages/[id]/share/[shareId]/route.ts` | Create | PATCH update permission, DELETE remove |
| `src/app/api/pages/[id]/access/route.ts` | Create | PATCH update general access |
| `src/hooks/usePageShares.ts` | Create | Share CRUD hooks |
| `src/components/page/ShareButton.tsx` | Create | Share button in header |
| `src/components/page/ShareDialog.tsx` | Create | Share dialog with tabs |
| `src/components/page/ShareDialogInvite.tsx` | Create | Email invite section |
| `src/components/page/ShareDialogMemberList.tsx` | Create | Member list with permissions |
| `src/components/page/ShareDialogGeneralAccess.tsx` | Create | General access dropdown |
| `src/components/page/PermissionDropdown.tsx` | Create | Permission level selector |
| `src/components/workspace/PageHeader.tsx` | Modify | Add ShareButton to header |
| `src/types/page.ts` | Modify | Add Permission, GeneralAccess, PageShare types |
| Tests | Create | Unit, integration, E2E tests |

---

**Last Updated:** 2026-02-25
