# SKB-50.4: Rebuild PageLinks & Verify Graph

**Story ID:** SKB-50.4
**Epic:** EPIC-50 (Chemistry KB — Graph Interconnectivity)
**Points:** 3
**Priority:** Medium
**Status:** Not Started
**Depends on:** SKB-50.3

---

## User Story

As a developer, I want to rebuild all PageLink records after fixing templates and verify that the knowledge graph is now richly connected, so I can confirm the graph interconnectivity work is complete.

---

## What This Story Delivers

After stories 50.1–50.3 fix wikilink persistence, experiment cross-references, and entity cross-references, the existing `PageLink` records in the database are stale. This story:

1. Adds a `--rebuild-links` flag to the chemistry sync script
2. After sync completes, calls `rebuildAllPageLinks(tenantId)` to regenerate all PageLink records
3. Logs connectivity statistics so developers can verify the graph improved

---

## Technical Specification

### Add `--rebuild-links` Flag

In `scripts/sync-chemeln.ts` (or the chemistry sync entry point):

```typescript
const args = process.argv.slice(2);
const rebuildLinks = args.includes('--rebuild-links');

// ... existing sync logic ...

if (rebuildLinks) {
  console.log('Rebuilding all PageLinks...');
  const result = await rebuildAllPageLinks(tenantId);
  console.log(`Rebuilt ${result.totalLinks} page links across ${result.pagesProcessed} pages`);
}
```

### PageLink Rebuild

The `rebuildAllPageLinks()` function already exists in `src/lib/wikilinks/indexer.ts`. It:
1. Deletes all existing PageLink records for the tenant
2. Scans all pages for wikilinks
3. Resolves wikilinks to page IDs
4. Creates new PageLink records

### Connectivity Verification Logging

After rebuild, log a summary of graph connectivity:

```typescript
async function logGraphConnectivity(tenantId: string): Promise<void> {
  const stats = {
    totalPages: await prisma.page.count({ where: { tenantId } }),
    totalPageLinks: await prisma.pageLink.count({ where: { tenantId } }),
    // Count pages with at least one outgoing link
    pagesWithLinks: await prisma.pageLink.groupBy({
      by: ['sourcePageId'],
      where: { tenantId },
      _count: true,
    }).then(r => r.length),
    // Count pages with at least one incoming link (backlinks)
    pagesWithBacklinks: await prisma.pageLink.groupBy({
      by: ['targetPageId'],
      where: { tenantId },
      _count: true,
    }).then(r => r.length),
  };

  console.log('\n=== Graph Connectivity Report ===');
  console.log(`Total pages: ${stats.totalPages}`);
  console.log(`Total links: ${stats.totalPageLinks}`);
  console.log(`Pages with outgoing links: ${stats.pagesWithLinks} (${Math.round(stats.pagesWithLinks / stats.totalPages * 100)}%)`);
  console.log(`Pages with backlinks: ${stats.pagesWithBacklinks} (${Math.round(stats.pagesWithBacklinks / stats.totalPages * 100)}%)`);
  console.log('================================\n');
}
```

### Expected Improvement

Before this epic:
- Experiment pages → chemicals (via Reagents section wikilinks): **working**
- Experiment pages → reaction type, researcher, substrate class: **broken** (table wikilinks lost)
- Entity pages → experiments: **broken** (short ELN IDs don't resolve)
- Entity pages → other entities: **missing** (empty sections)

After this epic:
- All of the above should be **working**
- Graph should show 6 types of edges: experiment↔chemical, experiment↔reaction type, experiment↔researcher, experiment↔substrate class, reaction type↔chemical, reaction type↔researcher

---

## Files to Modify

- `scripts/sync-chemeln.ts` — Add `--rebuild-links` flag and connectivity logging

## Files to Verify

- `src/lib/wikilinks/indexer.ts` — Confirm `rebuildAllPageLinks()` works correctly
- `src/lib/graph/builder.ts` — Confirm graph builder reads PageLink records for edges

---

## Acceptance Criteria

- [ ] `--rebuild-links` flag triggers full PageLink rebuild after sync
- [ ] Log output shows: "Rebuilt X page links across Y pages"
- [ ] Connectivity report logged with page/link counts
- [ ] Graph API returns edges for: experiment↔chemical, experiment↔reaction type, experiment↔researcher, experiment↔substrate class, reaction type↔chemical, reaction type↔researcher
- [ ] Knowledge graph visualization shows connected clusters instead of isolated nodes
- [ ] No orphaned PageLink records (all source/target pages exist)

---

## Verification Strategy

1. Run sync without `--rebuild-links` first to apply template changes
2. Run sync with `--rebuild-links` to rebuild PageLinks
3. Check log output for connectivity report — compare before/after numbers
4. Open knowledge graph in the web UI — verify connected clusters
5. Click through a few entity pages — verify "Related" sections have clickable links
6. Query `PageLink` table directly to verify edge types exist

---

## Implementation Notes

- `rebuildAllPageLinks()` deletes and recreates ALL links, not just chemistry ones — this is safe but means it touches the entire tenant's links
- For large tenants, the rebuild could take a few seconds — log progress
- The `--rebuild-links` flag should be optional (not run on every sync) since it's expensive
- Consider also adding a `--dry-run` mode that reports what would change without actually rebuilding

---

**Last Updated:** 2026-03-23
