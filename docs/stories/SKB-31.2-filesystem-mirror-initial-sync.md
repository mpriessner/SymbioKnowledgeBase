# Story SKB-31.2: Filesystem Mirror — Initial Sync & Folder Structure

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.2
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-31.1 (serialization must be deterministic)

---

## User Story

As a SymbioKnowledgeBase administrator, I want to run a command that generates a complete folder of Markdown files mirroring every page in the database, So that I have a browsable, file-based copy of the entire knowledge base that agents and developers can navigate.

---

## Acceptance Criteria

### Folder Structure Generation
- [ ] A CLI command `npx tsx scripts/sync-mirror.ts` generates the full mirror
- [ ] An API endpoint `POST /api/sync/init` triggers the same generation
- [ ] The mirror root directory is configurable via environment variable `MIRROR_DIR` (default: `data/mirror/`)
- [ ] Each tenant gets its own subfolder: `data/mirror/{tenantId}/`
- [ ] Page hierarchy maps to folder hierarchy following these rules:

**Rule 1 — Leaf page (no children):**
```
Page "Welcome" (no children)
→ data/mirror/{tenant}/Welcome.md
```

**Rule 2 — Page WITH children:**
```
Page "Projects" (has children: "Alpha", "Beta")
→ data/mirror/{tenant}/Projects/
  ├── _index.md          (the "Projects" page itself)
  ├── Alpha.md           (child page, leaf)
  └── Beta.md            (child page, leaf)
```

**Rule 3 — Deeply nested:**
```
Page "Projects" > "Alpha" > "Design Docs"
→ data/mirror/{tenant}/Projects/
  ├── _index.md
  └── Alpha/
      ├── _index.md
      └── Design Docs.md
```

**Rule 4 — Assets folder:**
```
→ data/mirror/{tenant}/Projects/Alpha/
  ├── _index.md
  └── assets/            (created when attachments exist)
      └── diagram.png
```

### Filename Generation
- [ ] Filenames derived from page title using safe slug rules:
  - Replace `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` with `-`
  - Trim leading/trailing whitespace and dots
  - Collapse multiple spaces/dashes to single dash
  - Max filename length: 200 characters (truncate with hash suffix if needed)
  - Preserve Unicode characters (don't ASCII-only-fy)
  - "Untitled" pages: use `Untitled-{shortId}.md`
- [ ] Duplicate filenames in the same folder: append `-2`, `-3`, etc.
- [ ] Examples: `"My Project: Phase 1"` → `My Project - Phase 1.md`

### File Content
- [ ] Each `.md` file contains YAML frontmatter + serialized content
- [ ] Frontmatter includes: id, title, icon, parent, position, spaceType, teamspaceId, created, updated
- [ ] Content is serialized using the existing `tiptapToMarkdown()` serializer
- [ ] Empty pages produce frontmatter + a single empty heading or blank content

### Sync Metadata
- [ ] A `.skb-meta.json` file is created at the tenant mirror root:
  ```json
  {
    "version": 1,
    "tenantId": "tenant-uuid",
    "generatedAt": "2026-02-25T12:00:00Z",
    "pageCount": 42,
    "fileMap": {
      "page-uuid-1": "Welcome.md",
      "page-uuid-2": "Projects/_index.md",
      "page-uuid-3": "Projects/Alpha.md"
    }
  }
  ```
- [ ] `fileMap` maps page IDs → relative file paths (enables fast ID↔file lookup)

### Promotion Logic
- [ ] When a leaf page gains its first child, the sync system must "promote" it:
  1. `Welcome.md` becomes `Welcome/_index.md`
  2. The child page is created as `Welcome/Child.md`
- [ ] When a parent page loses all children, it can be "demoted":
  1. `Welcome/_index.md` becomes `Welcome.md`
  2. The `Welcome/` folder is removed

### CLI Output
- [ ] CLI prints progress: "Syncing 42 pages for tenant abc..."
- [ ] CLI prints summary: "Created 42 files in data/mirror/abc/ (38 pages, 4 folders)"
- [ ] CLI supports `--dry-run` flag (prints what would be created without writing)
- [ ] CLI supports `--clean` flag (deletes existing mirror before regenerating)
- [ ] CLI supports `--tenant <id>` flag (sync specific tenant only)

### Error Handling
- [ ] Missing MIRROR_DIR parent: auto-create with `mkdir -p`
- [ ] Permission errors: log and skip file, continue with others
- [ ] Serialization failure for a page: log error, skip page, continue
- [ ] Summary includes error count: "42 synced, 2 errors"

---

## Architecture Overview

```
Initial Sync Flow:
──────────────────

npx tsx scripts/sync-mirror.ts
        │
        ▼
1. Read MIRROR_DIR from env (default: data/mirror/)
2. Fetch all tenants (or specific tenant if --tenant flag)
        │
        ▼
For each tenant:
3. Fetch all pages with blocks, ordered by parent→child
4. Build page tree (reuse existing getPageTree logic)
        │
        ▼
5. Map page tree to folder structure:
   - Root pages → files/folders at tenant root
   - Child pages → files/folders inside parent folder
   - Pages with children → folder + _index.md
   - Leaf pages → single .md file
        │
        ▼
6. For each page:
   a. Generate filename from title (slugify)
   b. Resolve path from page tree position
   c. Serialize content: frontmatter + tiptapToMarkdown()
   d. Write .md file to disk (atomic: write to .tmp, rename)
   e. Record in fileMap
        │
        ▼
7. Write .skb-meta.json
8. Print summary

Folder Mapping Algorithm:
─────────────────────────

function mapPageToPath(page, tree, parentPath):
  slug = slugify(page.title)
  children = tree.getChildren(page.id)

  if children.length > 0:
    // Page has children → becomes a folder
    folderPath = parentPath + "/" + slug
    mkdir(folderPath)
    writeMd(folderPath + "/_index.md", page)

    for child in children:
      mapPageToPath(child, tree, folderPath)
  else:
    // Leaf page → single file
    writeMd(parentPath + "/" + slug + ".md", page)
```

---

## Implementation Steps

### Step 1: Create Folder Structure Module

**File: `src/lib/sync/FolderStructure.ts`** (create)

```typescript
export interface FileMapping {
  pageId: string;
  relativePath: string;  // e.g., "Projects/_index.md"
  isIndex: boolean;      // true if _index.md
}

export function buildFolderStructure(
  pages: PageWithBlocks[],
  tree: PageTreeNode[]
): FileMapping[] {
  // Recursively map tree to file paths
  // Handle slug generation, deduplication, promotion
}

export function slugifyFilename(title: string): string {
  // Safe filename generation
}
```

### Step 2: Create Sync Configuration

**File: `src/lib/sync/config.ts`** (create)

```typescript
export const MIRROR_DIR = process.env.MIRROR_DIR || "data/mirror";
export const META_FILENAME = ".skb-meta.json";
export const INDEX_FILENAME = "_index.md";
export const ASSETS_DIRNAME = "assets";
```

### Step 3: Create Mirror Generator

**File: `src/lib/sync/MirrorGenerator.ts`** (create)

```typescript
export class MirrorGenerator {
  constructor(private mirrorDir: string) {}

  async generateForTenant(tenantId: string, options: { dryRun?: boolean; clean?: boolean }): Promise<SyncResult> {
    // 1. Fetch all pages with blocks
    // 2. Build page tree
    // 3. Build folder structure (file mappings)
    // 4. Write each .md file (atomic writes)
    // 5. Write .skb-meta.json
    // 6. Return summary
  }

  private async writeMarkdownFile(filePath: string, page: PageWithBlocks, frontmatter: FrontmatterData): Promise<void> {
    // Serialize content
    // Write atomically (temp file + rename)
  }
}
```

### Step 4: Create CLI Script

**File: `scripts/sync-mirror.ts`** (create)

```typescript
#!/usr/bin/env tsx
import { MirrorGenerator } from "../src/lib/sync/MirrorGenerator";

const args = parseArgs(process.argv.slice(2));
const generator = new MirrorGenerator(MIRROR_DIR);

if (args.tenant) {
  await generator.generateForTenant(args.tenant, { dryRun: args.dryRun, clean: args.clean });
} else {
  const tenants = await prisma.tenant.findMany();
  for (const tenant of tenants) {
    await generator.generateForTenant(tenant.id, { dryRun: args.dryRun, clean: args.clean });
  }
}
```

### Step 5: Create API Endpoint

**File: `src/app/api/sync/init/route.ts`** (create)

```typescript
// POST /api/sync/init — Trigger initial sync
export const POST = withTenant(async (req, context) => {
  const generator = new MirrorGenerator(MIRROR_DIR);
  const result = await generator.generateForTenant(context.tenantId, {});
  return NextResponse.json({ data: result });
});
```

---

## Testing Requirements

### Unit Tests (12+ cases)

**File: `src/__tests__/lib/sync/FolderStructure.test.ts`**

- Single root page → `Page.md`
- Page with children → `Page/_index.md` + `Page/Child.md`
- Deeply nested (3 levels) → correct folder nesting
- Duplicate titles in same folder → `Page.md`, `Page-2.md`
- Special characters in title → safe slug
- Very long title → truncated with hash
- Untitled pages → `Untitled-{id}.md`

**File: `src/__tests__/lib/sync/MirrorGenerator.test.ts`**

- Generates correct number of files
- Files contain valid frontmatter
- Files contain serialized content
- `.skb-meta.json` has correct fileMap
- `--dry-run` creates no files
- `--clean` removes existing files before sync

### Integration Tests (6+ cases)

**File: `src/__tests__/integration/initial-sync.test.ts`**

- Full sync of 10-page knowledge base → verify all files exist
- Folder structure matches page tree hierarchy
- Frontmatter IDs match database page IDs
- Content round-trips correctly (serialize → read back → compare)
- POST /api/sync/init returns sync result
- Multi-tenant: each tenant gets separate folder

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sync/FolderStructure.ts` | Create | Page tree → folder mapping |
| `src/lib/sync/MirrorGenerator.ts` | Create | Full mirror generation logic |
| `src/lib/sync/config.ts` | Create | Mirror directory configuration |
| `src/lib/sync/slug.ts` | Create | Filename slug generation |
| `src/lib/sync/types.ts` | Create | Sync-related TypeScript types |
| `scripts/sync-mirror.ts` | Create | CLI command for initial sync |
| `src/app/api/sync/init/route.ts` | Create | API trigger for initial sync |
| `.env.example` | Modify | Add MIRROR_DIR variable |
| Tests | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25
