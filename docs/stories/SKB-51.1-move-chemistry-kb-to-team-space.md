# Story SKB-51.1: Move Chemistry KB to Team Space

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.1
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-45 (Chemistry KB Data Model must exist)

---

## User Story

As an organization admin, I want the Chemistry KB to live in a shared Team space rather than a single user's Private space, So that all researchers in the organization can access institutional knowledge and contribute their learnings.

---

## Acceptance Criteria

1. **Teamspace Creation**
   - [ ] New teamspace "Chemistry KB" created with `spaceType: TEAM`
   - [ ] Teamspace has default role assignments: org admins = ADMIN, all members = MEMBER
   - [ ] Teamspace `slug`: `chemistry-kb`
   - [ ] Teamspace `description`: "Institutional chemistry knowledge — experiments, best practices, and procedures"

2. **Page Migration**
   - [ ] Chemistry KB root page and all descendants moved from PRIVATE to TEAM space
   - [ ] `page.spaceType` updated to `TEAM` for all migrated pages
   - [ ] `page.teamspaceId` set to the Chemistry KB teamspace ID
   - [ ] Page hierarchy (parent-child relationships) preserved exactly
   - [ ] Page positions within each level preserved

3. **Migration Script**
   - [ ] Script: `scripts/migrate-chemistry-kb-to-team.ts`
   - [ ] Accepts `--tenant <id>` argument
   - [ ] Accepts `--dry-run` flag to preview changes without writing
   - [ ] Idempotent: running twice produces same result
   - [ ] Outputs migration summary:
     ```
     Migrating Chemistry KB to Team Space...
     Teamspace: chemistry-kb (created / already exists)
     Pages to migrate: 15
     Root: Chemistry Knowledge Base → TEAM
     Category: Experiments → TEAM
     ...
     Migration complete. 15 pages moved to Team space.
     ```

4. **setupChemistryKbHierarchy Update**
   - [ ] `setupChemistryKbHierarchy()` in `src/lib/chemistryKb/setupHierarchy.ts` updated to create pages with `spaceType: TEAM`
   - [ ] New parameter: `teamspaceId` (required)
   - [ ] Function creates or finds the Chemistry KB teamspace before creating pages

5. **Sidebar Display**
   - [ ] Chemistry KB appears in a "Team" section of the sidebar, not "Private"
   - [ ] All org members can see the Chemistry KB in their sidebar
   - [ ] Icon and title unchanged

6. **Access Control**
   - [ ] MEMBER role: can read all pages, can create pages under Experiments category
   - [ ] ADMIN role: can edit any page, manage categories, promote content
   - [ ] GUEST role: read-only access
   - [ ] Existing PRIVATE experiment pages remain private (not migrated)

---

## Technical Implementation Notes

### Database Changes
No schema changes needed. Existing fields used:
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
- `scripts/migrate-chemistry-kb-to-team.ts` — CREATE
- `src/lib/chemistryKb/setupHierarchy.ts` — MODIFY (add teamspaceId param)
- `src/lib/pages/getPageTree.ts` — VERIFY (getPageTreeBySpace should show TEAM pages)

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

- [ ] Migration script passes on test tenant
- [ ] Chemistry KB appears in Team section of sidebar
- [ ] All org members can view Chemistry KB pages
- [ ] setupChemistryKbHierarchy creates TEAM pages
- [ ] Unit tests for migration logic
- [ ] Dry-run mode works correctly
