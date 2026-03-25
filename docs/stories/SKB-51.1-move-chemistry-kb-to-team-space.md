# Story SKB-51.1: Move Chemistry KB to Team Space

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.1
**Story Points:** 3 | **Priority:** High | **Status:** Mostly Complete
**Depends On:** EPIC-45 (Chemistry KB Data Model must exist)

---

## User Story

As an organization admin, I want the Chemistry KB to live in a shared Team space rather than a single user's Private space, So that all researchers in the organization can access institutional knowledge and contribute their learnings.

---

## Acceptance Criteria

1. **Teamspace Creation**
   - [x] New teamspace "Chemistry KB" created with `spaceType: TEAM`
   - [x] Teamspace has default role assignments: org admins = ADMIN, all members = MEMBER
   - [ ] Teamspace `slug`: `chemistry-kb` — **BLOCKED: Teamspace model missing `slug` field (needs schema migration)**
   - [ ] Teamspace `description` — **BLOCKED: Teamspace model missing `description` field (needs schema migration)**

2. **Page Migration**
   - [x] Chemistry KB root page and all descendants moved from PRIVATE to TEAM space
   - [x] `page.spaceType` updated to `TEAM` for all migrated pages
   - [x] `page.teamspaceId` set to the Chemistry KB teamspace ID
   - [x] Page hierarchy (parent-child relationships) preserved exactly
   - [x] Page positions within each level preserved

3. **Migration Script**
   - [x] Script: `scripts/migrate-chemistry-kb-to-team.ts`
   - [x] Accepts `--tenant <id>` argument
   - [x] Accepts `--dry-run` flag to preview changes without writing
   - [x] Idempotent: running twice produces same result
   - [x] Outputs migration summary:
     ```
     Migrating Chemistry KB to Team Space...
     Teamspace: chemistry-kb (created / already exists)
     Pages to migrate: 15
     Root: Chemistry Knowledge Base -> TEAM
     Category: Experiments -> TEAM
     ...
     Migration complete. 15 pages moved to Team space.
     ```

4. **setupChemistryKbHierarchy Update**
   - [x] `setupChemistryKbHierarchy()` in `src/lib/chemistryKb/setupHierarchy.ts` updated to create pages with `spaceType: TEAM`
   - [x] New parameter: `teamspaceId` (optional, via `SetupOptions`)
   - [ ] Function creates or finds the Chemistry KB teamspace before creating pages — **GAP: caller must provide existing teamspaceId**

5. **Sidebar Display**
   - [x] Backend: `getPageTreeBySpace()` returns `{ private, team, agent }` structure
   - [ ] Frontend: Sidebar components need to call `getPageTreeBySpace()` and display Team section separately
   - [x] Icon and title unchanged

6. **Access Control**
   - [x] Role model exists (TeamspaceMember with OWNER/ADMIN/MEMBER/GUEST roles)
   - [ ] Permission enforcement middleware — **NOT IMPLEMENTED: no middleware checking user's teamspace role before page access**
   - [ ] MEMBER/ADMIN/GUEST role enforcement on page mutation endpoints
   - [x] Existing PRIVATE experiment pages remain private (not migrated)

---

## Implementation Status (2026-03-24)

### What's Built
- Migration script with full CLI (--tenant, --dry-run, idempotent)
- Page model has `spaceType` (PRIVATE/TEAM/AGENT) and `teamspaceId` fields
- Teamspace/TeamspaceMember models with role enum
- `getPageTreeBySpace()` for backend tree filtering
- setupHierarchy accepts optional teamspaceId

### Remaining Gaps
1. **Schema migration**: Add `slug` and `description` fields to Teamspace model
2. **Auto-create teamspace**: setupHierarchy should create teamspace if not found
3. **Sidebar frontend**: Wire `getPageTreeBySpace()` into sidebar components
4. **Access control middleware**: Enforce roles on page endpoints

---

## Technical Implementation Notes

### Database Changes
Schema migration needed for Teamspace model:
- Add `slug: String @unique` with composite index `[tenantId, slug]`
- Add `description: String?`

Existing fields already used:
- `Page.spaceType` — Change from `PRIVATE` to `TEAM`
- `Page.teamspaceId` — Set to new teamspace ID
- `Teamspace` model — Create new record

### Migration Query (Prisma)
```typescript
// Find Chemistry KB root
const root = await prisma.page.findFirst({
  where: { tenantId, title: "Chemistry Knowledge Base", spaceType: "PRIVATE" },
});

// Create teamspace
const teamspace = await prisma.teamspace.upsert({
  where: { tenantId_slug: { tenantId, slug: "chemistry-kb" } },
  create: {
    tenantId,
    name: "Chemistry KB",
    slug: "chemistry-kb",
    description: "Institutional chemistry knowledge",
  },
  update: {},
});

// Get all descendant page IDs (recursive CTE or app-level traversal)
const descendants = await getAllDescendantIds(root.id, tenantId);

// Bulk update
await prisma.page.updateMany({
  where: { id: { in: [root.id, ...descendants] } },
  data: { spaceType: "TEAM", teamspaceId: teamspace.id },
});
```

### Key Files
- `scripts/migrate-chemistry-kb-to-team.ts` — DONE
- `src/lib/chemistryKb/setupHierarchy.ts` — DONE (teamspaceId param)
- `src/lib/pages/getPageTree.ts` — DONE (getPageTreeBySpace)
- `src/app/api/teamspaces/route.ts` — DONE (CRUD)
- `src/app/api/teamspaces/[id]/members/route.ts` — DONE (member management)

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Run migration on tenant with Chemistry KB | All pages moved to TEAM space |
| Run migration twice (idempotent) | Second run: "already exists" for all pages |
| Run migration with --dry-run | No database changes, summary printed |
| Run migration on tenant without Chemistry KB | Error: "Chemistry KB root not found" |
| Non-member user queries page tree | Chemistry KB not visible |
| MEMBER user queries page tree | Chemistry KB visible in TEAM section |
| setupChemistryKbHierarchy with teamspaceId | New pages created as TEAM |

---

## Definition of Done

- [x] Migration script passes on test tenant
- [ ] Chemistry KB appears in Team section of sidebar
- [x] All org members can view Chemistry KB pages
- [x] setupChemistryKbHierarchy creates TEAM pages
- [ ] Unit tests for migration logic
- [x] Dry-run mode works correctly
