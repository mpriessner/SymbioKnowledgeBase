# Story SKB-17.3: Page Sharing & Visibility

**Epic:** Epic 17 - Teamspaces
**Story ID:** SKB-17.3
**Story Points:** 8 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-17.1 (teamspace data model), SKB-17.2 (sidebar team sections)

---

## User Story

As a user, I want to share pages with my team or make them public via a link, So that I can collaborate with teammates or share knowledge externally.

---

## Acceptance Criteria

1. **Share Button**
   - [ ] Share button in page header (icon: Share2 from lucide-react)
   - [ ] Opens ShareModal on click
   - [ ] Button tooltip: "Share this page"

2. **Share Modal**
   - [ ] Modal sections: "Visibility" and "Public Link"
   - [ ] Visibility section shows current state: "Private" or team name
   - [ ] Radio buttons: "Private" (teamspaceId = null), "Share with Team" (select teamspace dropdown)
   - [ ] Teamspace dropdown lists user's teams (from `GET /api/teamspaces`)
   - [ ] Save button calls `PATCH /api/pages/:id` with `{ teamspaceId: X | null }`
   - [ ] Success toast: "Page visibility updated"

3. **Page Permissions**
   - [ ] Permissions based on TeamspaceMember role:
     - **OWNER/ADMIN:** Full access (edit, share, delete)
     - **MEMBER:** Edit and view (cannot share or delete)
     - **GUEST:** Read-only (cannot edit, share, or delete)
   - [ ] Permission checks in API endpoints:
     - `PATCH /api/pages/:id` — requires MEMBER or higher
     - `DELETE /api/pages/:id` — requires ADMIN or higher
     - `PATCH /api/pages/:id/share` — requires ADMIN or higher
   - [ ] Client-side UI disabled states based on permissions

4. **Public Share Link**
   - [ ] "Generate Public Link" button in ShareModal
   - [ ] Calls `POST /api/pages/:id/share-link` → returns `{ token, url }`
   - [ ] Displays URL with Copy button
   - [ ] Link format: `https://app.example.com/shared/:token`
   - [ ] Expiration: 30 days (default), with date picker to set custom expiration
   - [ ] Revoke link button (calls `DELETE /api/pages/:id/share-link/:token`)

5. **Public Link Rendering**
   - [ ] Route: `/shared/:token` (outside auth, no login required)
   - [ ] Validates token in `PublicShareLink` table (not expired, not revoked)
   - [ ] Renders page in read-only mode (no edit UI, no sidebar)
   - [ ] Page header shows: "Shared by [User Name] via [Team Name or Private]"
   - [ ] 404 if token invalid or expired

6. **Database Model**
   - [ ] New `PublicShareLink` model:
     - Fields: `id`, `pageId`, `tenantId`, `token` (unique), `createdBy` (userId), `expiresAt`, `revokedAt`
     - Index on `token` for fast lookup
     - Cascade delete: deleting page deletes its share links

7. **Access Control in API**
   - [ ] `GET /api/pages/:id` checks:
     - If page.teamspaceId IS NULL → only creator can access
     - If page.teamspaceId IS NOT NULL → user must be teamspace member
     - Returns 403 if access denied
   - [ ] `PATCH /api/pages/:id` checks role for edit permission
   - [ ] `PATCH /api/pages/:id/share` checks role for share permission (ADMIN or OWNER)

---

## Technical Implementation Notes

### ShareModal Component

**File: `src/components/page/ShareModal.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useTeamspaces } from '@/hooks/useTeamspaces';
import { useUpdatePageVisibility } from '@/hooks/useUpdatePageVisibility';
import { useGenerateShareLink } from '@/hooks/useGenerateShareLink';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toast } from 'sonner';

interface ShareModalProps {
  pageId: string;
  currentTeamspaceId: string | null;
  onClose: () => void;
}

export function ShareModal({ pageId, currentTeamspaceId, onClose }: ShareModalProps) {
  const { data: teamspaces } = useTeamspaces();
  const { mutate: updateVisibility, isPending } = useUpdatePageVisibility();
  const { mutate: generateLink, data: shareLink } = useGenerateShareLink();

  const [visibility, setVisibility] = useState<'private' | 'team'>(
    currentTeamspaceId ? 'team' : 'private'
  );
  const [selectedTeamspace, setSelectedTeamspace] = useState(currentTeamspaceId || '');

  const handleSave = () => {
    const teamspaceId = visibility === 'private' ? null : selectedTeamspace;
    updateVisibility(
      { pageId, teamspaceId },
      {
        onSuccess: () => {
          toast.success('Page visibility updated');
          onClose();
        },
      }
    );
  };

  const handleGenerateLink = () => {
    generateLink({ pageId, expiresInDays: 30 });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Page</DialogTitle>
        </DialogHeader>

        {/* Visibility Section */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Visibility</label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                />
                <span className="text-sm">Private (only me)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="team"
                  checked={visibility === 'team'}
                  onChange={() => setVisibility('team')}
                />
                <span className="text-sm">Share with Team</span>
              </label>
            </div>
          </div>

          {visibility === 'team' && (
            <Select
              value={selectedTeamspace}
              onChange={(e) => setSelectedTeamspace(e.target.value)}
            >
              <option value="">Select a team</option>
              {teamspaces?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.icon} {team.name}
                </option>
              ))}
            </Select>
          )}

          <Button onClick={handleSave} disabled={isPending || (visibility === 'team' && !selectedTeamspace)}>
            Save Changes
          </Button>
        </div>

        {/* Public Link Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium">Public Link</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Anyone with the link can view this page (read-only)
          </p>
          {!shareLink ? (
            <Button onClick={handleGenerateLink} variant="secondary" className="mt-2">
              Generate Public Link
            </Button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareLink.url}
                  readOnly
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink.url);
                    toast.success('Link copied to clipboard');
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Expires on {new Date(shareLink.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### API Endpoint: Update Page Visibility

**File: `src/app/api/pages/[id]/share/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';

const updateVisibilitySchema = z.object({
  teamspaceId: z.string().uuid().nullable(),
});

export const PATCH = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id: pageId } = params;
  const body = await req.json();
  const parsed = updateVisibilitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors, meta: { timestamp: new Date().toISOString() } },
      { status: 400 }
    );
  }

  // Fetch current page
  const page = await prisma.page.findUnique({
    where: { id: pageId, tenantId },
  });

  if (!page) {
    return NextResponse.json(
      { error: 'Page not found', meta: { timestamp: new Date().toISOString() } },
      { status: 404 }
    );
  }

  // Check permissions
  if (page.teamspaceId) {
    // Page is currently in a team — user must be ADMIN or OWNER
    const member = await prisma.teamspaceMember.findUnique({
      where: {
        teamspaceId_userId: { teamspaceId: page.teamspaceId, userId },
      },
    });

    if (!member || !['ADMIN', 'OWNER'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to share this page', meta: { timestamp: new Date().toISOString() } },
        { status: 403 }
      );
    }
  } else {
    // Page is private — only creator can share
    if (page.creatorId !== userId) {
      return NextResponse.json(
        { error: 'Only the page creator can share a private page', meta: { timestamp: new Date().toISOString() } },
        { status: 403 }
      );
    }
  }

  // If moving to a team, verify user is a member of that team
  if (parsed.data.teamspaceId) {
    const targetMember = await prisma.teamspaceMember.findUnique({
      where: {
        teamspaceId_userId: { teamspaceId: parsed.data.teamspaceId, userId },
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: 'You are not a member of the target teamspace', meta: { timestamp: new Date().toISOString() } },
        { status: 403 }
      );
    }
  }

  // Update page visibility
  const updatedPage = await prisma.page.update({
    where: { id: pageId, tenantId },
    data: { teamspaceId: parsed.data.teamspaceId },
  });

  return NextResponse.json({
    data: {
      id: updatedPage.id,
      teamspaceId: updatedPage.teamspaceId,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### API Endpoint: Generate Public Share Link

**File: `src/app/api/pages/[id]/share-link/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

const generateLinkSchema = z.object({
  expiresInDays: z.number().min(1).max(365).default(30),
});

export const POST = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id: pageId } = params;
  const body = await req.json();
  const parsed = generateLinkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors, meta: { timestamp: new Date().toISOString() } },
      { status: 400 }
    );
  }

  // Verify page exists and user has access
  const page = await prisma.page.findUnique({
    where: { id: pageId, tenantId },
  });

  if (!page) {
    return NextResponse.json(
      { error: 'Page not found', meta: { timestamp: new Date().toISOString() } },
      { status: 404 }
    );
  }

  // Generate unique token
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays);

  // Create share link
  const shareLink = await prisma.publicShareLink.create({
    data: {
      pageId,
      tenantId,
      token,
      createdBy: userId,
      expiresAt,
    },
  });

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/shared/${token}`;

  return NextResponse.json(
    {
      data: {
        token: shareLink.token,
        url,
        expiresAt: shareLink.expiresAt.toISOString(),
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});
```

---

### Public Share Page

**File: `src/app/shared/[token]/page.tsx`**

```typescript
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';

interface SharedPageProps {
  params: { token: string };
}

export default async function SharedPage({ params }: SharedPageProps) {
  const { token } = params;

  // Validate token
  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      page: {
        include: {
          blocks: { orderBy: { position: 'asc' } },
          teamspace: true,
        },
      },
      createdByUser: { select: { name: true } },
    },
  });

  if (!shareLink || shareLink.revokedAt || shareLink.expiresAt < new Date()) {
    notFound();
  }

  const { page, createdByUser } = shareLink;

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Shared by {createdByUser.name || 'Unknown'} via {page.teamspace?.name || 'Private'}
        </p>
        <h1 className="mt-2 text-4xl font-bold">{page.title}</h1>
      </div>

      {/* Page Content (Read-Only) */}
      <div className="space-y-2">
        {page.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} readOnly />
        ))}
      </div>
    </div>
  );
}
```

---

### Prisma Schema Updates

**File: `prisma/schema.prisma`**

```prisma
model PublicShareLink {
  id        String    @id @default(uuid())
  pageId    String    @map("page_id")
  tenantId  String    @map("tenant_id")
  token     String    @unique
  createdBy String    @map("created_by")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  // Relations
  tenant         Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  page           Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)
  createdByUser  User   @relation(fields: [createdBy], references: [id], onDelete: Cascade)

  // Indexes
  @@index([token], map: "idx_public_share_links_token")
  @@index([pageId], map: "idx_public_share_links_page_id")

  @@map("public_share_links")
}

// Update Page model
model Page {
  // ... existing fields ...
  publicShareLinks PublicShareLink[]
}

// Update User model
model User {
  // ... existing fields ...
  createdShareLinks PublicShareLink[]
}

// Update Tenant model
model Tenant {
  // ... existing fields ...
  publicShareLinks PublicShareLink[]
}
```

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/page/ShareModal.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareModal } from '@/components/page/ShareModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

vi.mock('@/hooks/useTeamspaces', () => ({
  useTeamspaces: () => ({
    data: [
      { id: '1', name: 'Team A', icon: '🚀', role: 'ADMIN', memberCount: 5 },
    ],
    isLoading: false,
  }),
}));

describe('ShareModal', () => {
  it('should render visibility options', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShareModal pageId="123" currentTeamspaceId={null} onClose={() => {}} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Private (only me)')).toBeInTheDocument();
    expect(screen.getByText('Share with Team')).toBeInTheDocument();
  });

  it('should show teamspace dropdown when "Share with Team" is selected', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShareModal pageId="123" currentTeamspaceId={null} onClose={() => {}} />
      </QueryClientProvider>
    );

    const teamRadio = screen.getByLabelText('Share with Team');
    fireEvent.click(teamRadio);

    expect(screen.getByText('Team A')).toBeInTheDocument();
  });
});
```

### Integration Tests: `src/__tests__/api/pages/share/route.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/pages/[id]/share/route';
import { prisma } from '@/lib/db';
import { mockAuthContext } from '@/test-utils/mockAuth';

describe('PATCH /api/pages/:id/share', () => {
  beforeEach(async () => {
    await prisma.page.deleteMany();
    await prisma.teamspace.deleteMany();
  });

  it('should move private page to teamspace', async () => {
    const { tenantId, userId } = mockAuthContext();

    // Create private page
    const page = await prisma.page.create({
      data: { tenantId, title: 'Private Page', creatorId: userId },
    });

    // Create teamspace with user as ADMIN
    const teamspace = await prisma.teamspace.create({
      data: { tenantId, name: 'Team' },
    });
    await prisma.teamspaceMember.create({
      data: { teamspaceId: teamspace.id, userId, role: 'ADMIN' },
    });

    // Share page to teamspace
    const req = new Request(`http://localhost/api/pages/${page.id}/share`, {
      method: 'PATCH',
      body: JSON.stringify({ teamspaceId: teamspace.id }),
    });

    const response = await PATCH(req, { tenantId, userId, params: { id: page.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.teamspaceId).toBe(teamspace.id);

    // Verify in database
    const updatedPage = await prisma.page.findUnique({ where: { id: page.id } });
    expect(updatedPage?.teamspaceId).toBe(teamspace.id);
  });

  it('should reject sharing if user is not ADMIN or OWNER', async () => {
    const { tenantId, userId } = mockAuthContext();

    // Create teamspace page where user is GUEST
    const teamspace = await prisma.teamspace.create({
      data: { tenantId, name: 'Team' },
    });
    await prisma.teamspaceMember.create({
      data: { teamspaceId: teamspace.id, userId, role: 'GUEST' },
    });
    const page = await prisma.page.create({
      data: { tenantId, title: 'Team Page', teamspaceId: teamspace.id },
    });

    // Attempt to move page (should fail)
    const req = new Request(`http://localhost/api/pages/${page.id}/share`, {
      method: 'PATCH',
      body: JSON.stringify({ teamspaceId: null }),
    });

    const response = await PATCH(req, { tenantId, userId, params: { id: page.id } });
    expect(response.status).toBe(403);
  });
});
```

### E2E Tests: `tests/e2e/page-sharing.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Page Sharing', () => {
  test('should share page to team', async ({ page }) => {
    await page.goto('/pages/123');

    // Click Share button
    await page.click('[aria-label="Share this page"]');

    // Select "Share with Team"
    await page.click('text=Share with Team');

    // Select teamspace
    await page.selectOption('select', 'team-1');

    // Save
    await page.click('text=Save Changes');

    // Verify toast
    await expect(page.locator('text=Page visibility updated')).toBeVisible();
  });

  test('should generate public link', async ({ page }) => {
    await page.goto('/pages/123');

    // Click Share button
    await page.click('[aria-label="Share this page"]');

    // Generate public link
    await page.click('text=Generate Public Link');

    // Copy link
    await page.click('text=Copy');

    // Verify toast
    await expect(page.locator('text=Link copied to clipboard')).toBeVisible();
  });

  test('should access page via public link', async ({ page, context }) => {
    // Generate link (setup)
    await page.goto('/pages/123');
    await page.click('[aria-label="Share this page"]');
    await page.click('text=Generate Public Link');
    const linkUrl = await page.locator('input[readonly]').inputValue();

    // Open link in new incognito context (no auth)
    const incognitoPage = await context.newPage();
    await incognitoPage.goto(linkUrl);

    // Verify page is visible
    await expect(incognitoPage.locator('h1')).toHaveText('Test Page');
    await expect(incognitoPage.locator('text=Shared by')).toBeVisible();
  });
});
```

---

## Dependencies

- **SKB-17.1:** Teamspace data model and member roles
- **SKB-17.2:** Sidebar sections (page sharing affects sidebar display)

---

## Dev Notes

### Permission Hierarchy

```
OWNER   → All permissions
ADMIN   → Edit, share, manage members (cannot delete teamspace)
MEMBER  → Edit pages (cannot share or manage)
GUEST   → Read-only
```

### Share Link Security

- **Token generation:** Use `crypto.randomBytes(16).toString('hex')` for unpredictable tokens
- **Expiration:** Default 30 days, enforced at query time (`WHERE expiresAt > NOW()`)
- **Revocation:** Soft delete (`revokedAt` timestamp) — allows audit trail
- **No auth required:** Public links bypass authentication entirely

### Edge Cases

- **Sharing already-shared page:** Allow moving from one teamspace to another (if user is ADMIN in both)
- **Revoking access:** Moving page from teamspace to private removes access for all team members
- **Expired links:** Return 404 (not 403) to avoid leaking existence of expired links

---

**Last Updated:** 2026-02-22
