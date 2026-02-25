# Story SKB-23.2: Workspace Creation & Switching

**Epic:** Epic 23 - Workspace Dropdown Menu Redesign
**Story ID:** SKB-23.2
**Story Points:** 8 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-23.1 (redesigned dropdown must exist with "New workspace" link)

---

## User Story

As a SymbioKnowledgeBase user, I want to create new workspaces and switch between them from the workspace dropdown, So that I can organize different projects or contexts into separate workspaces.

---

## Acceptance Criteria

### Workspace Creation Dialog
- [ ] Clicking "+ New workspace" in the dropdown opens a modal dialog
- [ ] Dialog contains:
  - Title: "Create a workspace"
  - Text input for workspace name (placeholder: "Acme Corp", autofocused)
  - Workspace avatar preview: shows the first letter of the typed name with generated color, updating live
  - "Create" button (disabled until name has 2+ characters)
  - "Cancel" button to dismiss
- [ ] Pressing Enter in the input submits the form (same as clicking Create)
- [ ] After creation:
  - The new workspace is created in the database
  - The user is automatically switched to the new workspace
  - The dropdown closes
  - The sidebar updates to show the new workspace name and empty page tree
  - A success toast: "Workspace created"

### Workspace API
- [ ] `POST /api/workspaces` — create a new workspace (tenant)
  - Body: `{ name: string }`
  - Validates: name is 2-50 characters, not blank
  - Creates: new Tenant record in database
  - Associates: current user as owner of the new tenant
  - Returns: `{ data: { id, name, createdAt } }` with 201 status
- [ ] `GET /api/workspaces` — list workspaces the current user belongs to
  - Returns: `{ data: [{ id, name, memberCount, plan, isCurrent }] }`
  - Sorted by creation date (oldest first)
- [ ] `POST /api/workspaces/switch` — switch to a different workspace
  - Body: `{ workspaceId: string }`
  - Validates: user is a member of the target workspace
  - Updates: user's active workspace in session/cookie
  - Returns: `{ data: { id, name } }`

### Workspace List in Dropdown
- [ ] Dropdown shows all workspaces the user belongs to (from `GET /api/workspaces`)
- [ ] Each workspace shows: avatar initial + workspace name
- [ ] The currently active workspace has a checkmark (✓)
- [ ] Clicking a different workspace:
  - Calls `POST /api/workspaces/switch`
  - Reloads the page/workspace data (page tree, settings, etc.)
  - Shows the new workspace name in the sidebar header
  - Success toast: "Switched to {workspace name}"
- [ ] If user has only 1 workspace, the list still shows it (with checkmark) — no special empty state

### Data Model
- [ ] The existing `Tenant` model in Prisma serves as the workspace
- [ ] A new `TenantMember` join table (or existing relationship) connects users to tenants
- [ ] Each user has an `activeTenantId` (stored in session, cookie, or user metadata)
- [ ] When switching workspaces, `activeTenantId` updates and all subsequent API calls use the new tenant
- [ ] Default: user's first created tenant is their initial active workspace

### Workspace Name Display
- [ ] The sidebar header trigger shows the active workspace's name (fetched from API, not hardcoded)
- [ ] The dropdown header shows the active workspace's name, plan, and member count
- [ ] Workspace name updates immediately after switching

### Error Handling
- [ ] Duplicate workspace name: allowed (names don't need to be unique)
- [ ] Empty workspace name: validation error "Name must be at least 2 characters"
- [ ] Name too long (> 50 chars): validation error "Name must be 50 characters or less"
- [ ] Switch to non-existent workspace: 404 error, toast "Workspace not found"
- [ ] Switch to workspace user is not a member of: 403 error, toast "Access denied"
- [ ] API failure on create: error toast "Failed to create workspace. Try again."

### Edge Cases
- [ ] New workspace starts with: no pages, no databases, default settings
- [ ] Switching workspace does NOT affect the other workspace's data (tenant isolation)
- [ ] User cannot delete their only workspace (deletion out of scope for this story)
- [ ] Settings are per-workspace (AI config, general settings, etc.)

---

## Architecture Overview

```
Workspace Creation & Switching
─────────────────────────────

Database Model:
───────────────

┌──────────┐       ┌──────────────────┐       ┌──────────┐
│  User    │       │  TenantMember    │       │  Tenant  │
│          │       │                  │       │          │
│  id      │──────▶│  userId          │       │  id      │
│  email   │       │  tenantId        │◀──────│  name    │
│  ...     │       │  role (owner/    │       │  plan    │
│          │       │   member)        │       │  ...     │
│          │       │  joinedAt        │       │          │
└──────────┘       └──────────────────┘       └──────────┘

Active workspace stored in:
  Option A: Cookie `skb_active_workspace=<tenantId>` (preferred — stateless)
  Option B: User metadata in Supabase `user.user_metadata.activeTenantId`

Workspace Switching Flow:
─────────────────────────

User clicks "Acme Corp" in workspace list
        │
        ▼
POST /api/workspaces/switch { workspaceId: "tenant-2" }
        │
        ▼
Server validates user is member of tenant-2
        │
        ▼
Set cookie: skb_active_workspace=tenant-2
        │
        ▼
Return success → client calls router.refresh()
        │
        ▼
All subsequent API calls use tenant-2 as tenantId
        │
        ▼
Sidebar refreshes: page tree, workspace name, settings
        │
        ▼
User sees Acme Corp workspace with its pages

Workspace Creation Flow:
─────────────────────────

User clicks "+ New workspace" → enters "Acme Corp" → clicks Create
        │
        ▼
POST /api/workspaces { name: "Acme Corp" }
        │
        ├── Create Tenant record { id: "tenant-2", name: "Acme Corp" }
        ├── Create TenantMember { userId, tenantId: "tenant-2", role: "owner" }
        └── Set active workspace to tenant-2
        │
        ▼
Client receives { id: "tenant-2", name: "Acme Corp" }
        │
        ├── Close dialog
        ├── router.refresh() → reload workspace data
        └── Toast: "Workspace created"
```

---

## Implementation Steps

### Step 1: Create/Update Data Model

**File: `prisma/schema.prisma`** (modify if needed)

Verify the Tenant model exists and add TenantMember if not present:

```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  plan      String   @default("free")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  members   TenantMember[]
  pages     Page[]
  databases Database[]
  // ... other relations
}

model TenantMember {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tenantId  String   @map("tenant_id")
  role      String   @default("owner") // "owner" | "admin" | "member"
  joinedAt  DateTime @default(now()) @map("joined_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([userId, tenantId])
  @@map("tenant_members")
}
```

Run migration if schema changes:
```bash
npx prisma migrate dev --name add-tenant-members
```

### Step 2: Create Workspace API Routes

**File: `src/app/api/workspaces/route.ts`**

```typescript
// GET: List workspaces for current user
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const memberships = await prisma.tenantMember.findMany({
    where: { userId: user.id },
    include: { tenant: true },
    orderBy: { joinedAt: "asc" },
  });

  const activeTenantId = getActiveTenantId(req); // from cookie

  return NextResponse.json({
    data: memberships.map(m => ({
      id: m.tenant.id,
      name: m.tenant.name,
      plan: m.tenant.plan,
      memberCount: 1, // TODO: count members
      isCurrent: m.tenant.id === activeTenantId,
      role: m.role,
    })),
  });
}

// POST: Create new workspace
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const { name } = await req.json();

  // Validate
  if (!name || name.trim().length < 2) return error(400, "Name must be at least 2 characters");
  if (name.trim().length > 50) return error(400, "Name must be 50 characters or less");

  // Create tenant + membership
  const tenant = await prisma.tenant.create({
    data: {
      name: name.trim(),
      members: { create: { userId: user.id, role: "owner" } },
    },
  });

  // Switch to new workspace
  const response = NextResponse.json({ data: tenant }, { status: 201 });
  response.cookies.set("skb_active_workspace", tenant.id, { path: "/", httpOnly: true, sameSite: "lax" });
  return response;
}
```

**File: `src/app/api/workspaces/switch/route.ts`**

```typescript
// POST: Switch active workspace
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const { workspaceId } = await req.json();

  // Verify membership
  const membership = await prisma.tenantMember.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId: workspaceId } },
    include: { tenant: true },
  });

  if (!membership) return error(403, "Access denied");

  // Set active workspace cookie
  const response = NextResponse.json({ data: { id: membership.tenant.id, name: membership.tenant.name } });
  response.cookies.set("skb_active_workspace", workspaceId, { path: "/", httpOnly: true, sameSite: "lax" });
  return response;
}
```

### Step 3: Create useWorkspaces Hook

**File: `src/hooks/useWorkspaces.ts`**

```typescript
export function useWorkspaces() {
  const query = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => fetch("/api/workspaces").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      fetch("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries(["workspaces"]),
  });

  const switchMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      fetch("/api/workspaces/switch", { method: "POST", body: JSON.stringify({ workspaceId }) }).then(r => r.json()),
    onSuccess: () => {
      // Refresh everything — new workspace means new data
      window.location.reload();
    },
  });

  return {
    workspaces: query.data?.data ?? [],
    isLoading: query.isLoading,
    createWorkspace: createMutation.mutate,
    isCreating: createMutation.isPending,
    switchWorkspace: switchMutation.mutate,
    isSwitching: switchMutation.isPending,
  };
}
```

### Step 4: Create WorkspaceCreateDialog Component

**File: `src/components/workspace/WorkspaceCreateDialog.tsx`**

```typescript
interface WorkspaceCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  isCreating: boolean;
}

// Modal dialog with:
// - Title: "Create a workspace"
// - Name input (autofocused, placeholder "Acme Corp")
// - Live avatar preview (initial + color from typed name)
// - Create button (disabled if name < 2 chars)
// - Cancel button
// - Enter submits, Escape cancels
```

### Step 5: Wire Workspace Data into Dropdown

**File: `src/components/workspace/WorkspaceDropdown.tsx`** (modify)

Replace the hardcoded workspace name and list with data from `useWorkspaces()`:

```typescript
const { workspaces, createWorkspace, switchWorkspace, isLoading } = useWorkspaces();
const activeWorkspace = workspaces.find(w => w.isCurrent);

// Trigger: activeWorkspace.name (not hardcoded "SymbioKnowledgeBase")
// Header: activeWorkspace.name, activeWorkspace.plan, activeWorkspace.memberCount
// Workspace list: workspaces.map(w => <WorkspaceItem ... isCurrent={w.isCurrent} />)
// New workspace: opens WorkspaceCreateDialog
// Switch: calls switchWorkspace(id)
```

### Step 6: Update Tenant Resolution in API Middleware

**File: `src/lib/auth/tenant.ts`** (create or modify)

Ensure all API routes resolve the active tenant from the cookie:

```typescript
export function getActiveTenantId(req: NextRequest): string {
  return req.cookies.get("skb_active_workspace")?.value ?? getDefaultTenantId(req);
}
```

---

## Testing Requirements

### Unit Tests (15+ cases)

**File: `src/__tests__/components/workspace/WorkspaceCreateDialog.test.tsx`**

- Dialog renders title, input, buttons
- Input is autofocused on open
- Create button disabled when name is empty
- Create button disabled when name has < 2 characters
- Create button enabled when name has 2+ characters
- Avatar preview updates live as user types
- Enter key submits the form
- Escape key closes dialog
- Cancel button closes dialog
- Name validation: too long (> 50 chars) shows error

**File: `src/__tests__/hooks/useWorkspaces.test.ts`**

- Returns workspaces from API
- createWorkspace calls POST /api/workspaces
- switchWorkspace calls POST /api/workspaces/switch
- isCreating true during creation
- isSwitching true during switch
- Cache invalidated after creation

### Integration Tests (12+ cases)

**File: `src/__tests__/integration/workspace-creation.test.tsx`**

- POST /api/workspaces creates tenant record in database
- POST /api/workspaces creates TenantMember with role="owner"
- POST /api/workspaces sets active workspace cookie
- POST /api/workspaces with empty name returns 400
- POST /api/workspaces with name > 50 chars returns 400
- GET /api/workspaces returns all user's workspaces
- GET /api/workspaces marks current workspace with isCurrent=true
- POST /api/workspaces/switch updates cookie
- POST /api/workspaces/switch with invalid workspace returns 403
- Dropdown shows correct workspace names from API
- Create workspace → workspace appears in dropdown list
- Switch workspace → sidebar updates with new workspace data

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/workspace-switching.test.ts`**

- Click "+ New workspace" → dialog opens → enter name → create → new workspace active
- New workspace: sidebar shows empty page tree
- Switch back to original workspace → original pages visible
- Workspace avatar and name update in sidebar header after switch

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add TenantMember model (if not exists) |
| `src/app/api/workspaces/route.ts` | Create | GET list, POST create workspace |
| `src/app/api/workspaces/switch/route.ts` | Create | POST switch active workspace |
| `src/hooks/useWorkspaces.ts` | Create | Workspace CRUD + switching hook |
| `src/components/workspace/WorkspaceCreateDialog.tsx` | Create | Workspace creation modal |
| `src/components/workspace/WorkspaceDropdown.tsx` | Modify | Wire real workspace data + creation |
| `src/lib/auth/tenant.ts` | Create/Modify | Active tenant resolution from cookie |
| `src/__tests__/components/workspace/WorkspaceCreateDialog.test.tsx` | Create | Dialog unit tests |
| `src/__tests__/hooks/useWorkspaces.test.ts` | Create | Hook unit tests |
| `src/__tests__/integration/workspace-creation.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/workspace-switching.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
