# Story SKB-20.2: Wikilink Auto-Linking on Agent Markdown Writes

**Epic:** Epic 20 - Agent Workflow Completion
**Story ID:** SKB-20.2
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-20.1 (MCP server working), EPIC-05 (Wikilink parsing exists)

---

## User Story

As an AI agent writing pages via the Agent API, I want my `[[wikilinks]]` in markdown to automatically create graph connections (PageLink records), So that the knowledge graph stays accurate and complete without manual intervention.

---

## Acceptance Criteria

- [ ] When agent POSTs a new page with markdown containing `[[Page Name]]`, PageLink records are created for each resolved link
- [ ] When agent PUTs updated markdown, PageLink records are synced (new links added, removed links deleted)
- [ ] Wikilink resolution is case-insensitive: `[[system architecture]]` matches page titled "System Architecture"
- [ ] Wikilink resolution handles display text: `[[Page Name|display text]]` links to "Page Name"
- [ ] Unresolvable wikilinks (no matching page title) are logged but do not cause errors
- [ ] Unresolvable wikilinks are preserved in the markdown (not stripped)
- [ ] Self-links (page linking to itself) are ignored (no PageLink created)
- [ ] Duplicate wikilinks in same page create only one PageLink record
- [ ] Stale links removed: if agent updates page and removes a `[[link]]`, the corresponding PageLink is deleted
- [ ] PageLink records include correct `tenantId` from agent context
- [ ] Wikilink processing does not significantly impact write latency (<100ms overhead)
- [ ] Round-trip fidelity: `tiptapToMarkdown(markdownToTiptap(md))` preserves all `[[wikilinks]]`
- [ ] Graph visualization updates after agent write (no cache staleness)
- [ ] Backlinks on target pages show the agent-created page as a source
- [ ] Works for both POST (create) and PUT (update) agent endpoints
- [ ] MCP `create_page` and `update_page` tools also trigger wikilink processing

---

## Architecture Overview

```
Wikilink Processing Flow (Agent Write)
────────────────────────────────────────

Agent sends:
  PUT /api/agent/pages/:id
  { "markdown": "See [[System Architecture]] and [[API Reference]]" }
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Markdown → TipTap Conversion                                 │
│     markdownToTiptap(markdown) → TipTap JSON                    │
│     Wikilinks become: { type: "wikilink", attrs: { page: ... }} │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Save TipTap JSON to Block                                    │
│     Upsert DOCUMENT block with new content                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Extract Wikilinks from Content                               │
│     parseWikilinksFromTiptap(content) → ["System Architecture", │
│                                          "API Reference"]       │
│                                                                  │
│     Strategy: Walk TipTap JSON tree, collect all nodes with      │
│     type "wikilink" or marks containing wikilink references      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Resolve Page Titles → Page IDs                               │
│     SELECT id FROM pages                                         │
│     WHERE tenant_id = $1                                         │
│       AND LOWER(title) = LOWER($2)                               │
│       AND deleted_at IS NULL                                     │
│                                                                  │
│     "System Architecture" → "d0000000-...-000000000002"          │
│     "API Reference"       → "d0000000-...-000000000003"          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Sync PageLink Records                                        │
│                                                                  │
│     Current links in DB for this page:                           │
│       source → "Old Target A", source → "Old Target B"           │
│                                                                  │
│     New links from content:                                      │
│       source → "System Architecture", source → "API Reference"   │
│                                                                  │
│     Diff:                                                        │
│       ADD: "System Architecture", "API Reference"                │
│       REMOVE: "Old Target A", "Old Target B"                     │
│                                                                  │
│     Execute:                                                     │
│       INSERT INTO page_links (source, target, tenant_id) ...     │
│       DELETE FROM page_links WHERE source = $1 AND target IN ... │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Wikilink Extraction Utility

**File: `src/lib/agent/wikilinks.ts`**

Functions to implement:
- `extractWikilinksFromTiptap(content: JSONContent): string[]` — walk TipTap JSON tree, return array of page titles referenced by wikilinks
- `extractWikilinksFromMarkdown(markdown: string): string[]` — regex-based extraction from raw markdown as fallback
- `resolveWikilinks(titles: string[], tenantId: string): Promise<Map<string, string>>` — resolve page titles to IDs (case-insensitive)
- `syncPageLinks(pageId: string, tenantId: string, targetPageIds: string[]): Promise<void>` — diff current PageLink records against new set, add missing, remove stale

### Step 2: Integrate into Agent API POST Handler

**File: `src/app/api/agent/pages/route.ts` (POST handler)**

After creating the page and saving the block content:
1. Extract wikilinks from the saved TipTap content
2. Resolve titles to IDs
3. Create PageLink records for resolved links

### Step 3: Integrate into Agent API PUT Handler

**File: `src/app/api/agent/pages/[id]/route.ts` (PUT handler)**

After updating the block content:
1. Extract wikilinks from the updated TipTap content
2. Resolve titles to IDs
3. Sync PageLink records (add new, remove stale)

### Step 4: Handle Edge Cases

- Self-links: filter out where `targetPageId === sourcePageId`
- Duplicates: use `Set` to deduplicate extracted titles
- Missing pages: log unresolved titles at debug level, do not error
- Display text: `[[Page|Display]]` → extract "Page" as the link target
- Empty markdown: remove all PageLinks for the page

### Step 5: Write Tests

**File: `src/__tests__/lib/agent/wikilinks.test.ts`**

Test cases:
- Extract single wikilink from markdown
- Extract multiple wikilinks
- Extract wikilink with display text `[[Page|text]]`
- Ignore duplicate wikilinks
- Handle no wikilinks (empty array)
- Case-insensitive title resolution
- Self-link filtering
- Stale link removal on update
- PageLink records have correct tenantId
- Round-trip: write markdown with links → read back → links preserved

---

## Testing Requirements

### Unit Tests (20+ cases)
- Wikilink regex extraction from markdown strings
- TipTap JSON tree walking for wikilink nodes
- Title deduplication and self-link filtering
- Diff algorithm (add/remove logic)

### Integration Tests (10+ cases)
- POST page with `[[Link]]` → verify PageLink record exists in DB
- PUT page adding new `[[Link]]` → verify new PageLink created
- PUT page removing `[[Link]]` → verify old PageLink deleted
- PUT page with unresolvable `[[NoSuchPage]]` → no error, no PageLink
- Verify graph API returns new edges after agent write
- Verify backlinks on target page include agent-created source

### E2E Tests (5+ cases)
- Agent creates page with 3 wikilinks → graph shows 3 edges → navigate to linked pages
- Agent updates page, removes 1 link, adds 1 → graph updates correctly
- Two agents write to different pages linking to same target → both edges exist

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/agent/wikilinks.ts` | Create | Wikilink extraction, resolution, and PageLink sync |
| `src/app/api/agent/pages/route.ts` | Modify | Add wikilink processing to POST handler |
| `src/app/api/agent/pages/[id]/route.ts` | Modify | Add wikilink processing to PUT handler |
| `src/__tests__/lib/agent/wikilinks.test.ts` | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25
