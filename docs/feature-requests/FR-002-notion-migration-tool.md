# FR-002: Notion Migration Tool

**Status:** Proposed  
**Priority:** Medium  
**Created:** 2026-02-21  
**Author:** Martin Priessner

---

## Summary

Enable seamless migration from Notion to SymbioBrain, preserving structure, content, links, and metadata.

---

## Problem

Users have existing knowledge in Notion. Switching tools shouldn't mean losing work or manually copying content.

---

## Requirements

### Must Have
- [ ] Import Notion workspace export (ZIP with markdown/CSV)
- [ ] Preserve page hierarchy (parent-child relationships)
- [ ] Convert Notion internal links to SymbioBrain wikilinks
- [ ] Import page properties/metadata
- [ ] Import database tables with all columns and rows
- [ ] Handle embedded images (download and store locally)

### Should Have
- [ ] Incremental sync (only import changed pages)
- [ ] Two-way sync (optional, for transition period)
- [ ] Import page icons and covers
- [ ] Preserve Notion page IDs as aliases (for external links)

### Nice to Have
- [ ] Direct API import (no export needed)
- [ ] Real-time sync via Notion webhooks
- [ ] Conflict resolution for concurrent edits
- [ ] Rollback capability

---

## Technical Approach

### Option A: Export-Based (Recommended for v1)

1. User exports Notion workspace (Markdown & CSV)
2. CLI tool parses export:
   ```bash
   symbio-brain import notion ./notion-export.zip
   ```
3. Creates pages, databases, and links
4. Reports import summary

**Pros:** Simple, no API auth needed, works offline
**Cons:** Manual export step, no incremental sync

### Option B: API-Based

1. User connects Notion via OAuth
2. Background job syncs workspace
3. Maintains mapping table (Notion ID → SymbioBrain ID)

**Pros:** Automated, incremental
**Cons:** API rate limits, complexity, auth flow

---

## Notion Export Format

Notion exports as:
```
Export/
├── Page Name abc123.md
├── Database Name def456/
│   ├── Row 1 ghi789.md
│   └── Row 2 jkl012.md
└── assets/
    └── image.png
```

### Key Transformations

| Notion | SymbioBrain |
|--------|-------------|
| `[Link](Page%20Name%20abc123.md)` | `[[Page Name]]` |
| `@mention` | `[[User Name]]` |
| `/page-id` blocks | Embedded page refs |
| Database properties | Page metadata |

---

## CLI Interface

```bash
# Basic import
symbio-brain import notion ./export.zip

# With options
symbio-brain import notion ./export.zip \
  --workspace default \
  --dry-run \
  --verbose \
  --skip-images

# Status
symbio-brain import status

# Rollback (if supported)
symbio-brain import rollback <import-id>
```

---

## Migration Workflow

```
1. Export Notion workspace
   └─> User downloads ZIP

2. Run import command
   └─> CLI validates export
   └─> Creates import plan
   └─> User confirms

3. Execute import
   └─> Creates pages
   └─> Creates databases  
   └─> Downloads images
   └─> Converts links

4. Verification
   └─> Compare page counts
   └─> Check broken links
   └─> Review import log

5. Cleanup (optional)
   └─> Delete Notion workspace
   └─> Update external references
```

---

## Success Metrics

- 100% of pages imported without errors
- All internal links resolve correctly
- Images display properly
- Database views functional
- Import completes in <5 min for 1000 pages

---

## Related

- FR-001: Agent Brain Architecture
- EPIC-03: Page Management
- EPIC-08: Database Table View

---

*This ensures users can transition to SymbioBrain without starting from scratch.*
