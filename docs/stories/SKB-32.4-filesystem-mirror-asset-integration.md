# Story SKB-32.4: Filesystem Mirror Asset Integration

**Epic:** Epic 32 - File Attachments & Local Drag-and-Drop
**Story ID:** SKB-32.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-32.1 (storage backend), EPIC-31 SKB-31.3 (DB→FS sync)

---

## User Story

As an AI agent browsing the filesystem mirror, I want file attachments to appear in `assets/` folders alongside their page's `.md` file with relative path references, so that I can see, add, and reference files using standard filesystem operations — and those changes are reflected in the web editor.

---

## Acceptance Criteria

### Serializer — Relative Paths in Markdown
- [ ] When serializing a page with image attachments, the Markdown contains relative paths:
  ```markdown
  ![Architecture Diagram](./assets/a1b2c3-architecture.png)
  ```
- [ ] When serializing a page with file block attachments, the Markdown contains:
  ```markdown
  [requirements.pdf (2.4 MB)](./assets/d4e5f6-requirements.pdf)
  ```
- [ ] Relative paths are computed from the `.md` file's location to the `assets/` folder:
  - Leaf page: `./assets/filename` (assets folder is sibling at same level)
  - Index page (`_index.md`): `./assets/filename` (assets folder is in same directory)
- [ ] External URLs (images from `http://` or `https://`) remain absolute — not converted to relative paths

### Deserializer — Relative Paths to Attachment IDs
- [ ] When parsing a `.md` file, relative asset paths (`./assets/...`) are resolved to `FileAttachment` records
- [ ] Resolution uses the `.skb-meta.json` fileMap to determine the page's location, then resolves the relative path
- [ ] If the referenced file exists on disk but has no `FileAttachment` record → create one (agent-placed file)
- [ ] If the referenced file doesn't exist on disk → leave the path as-is (broken link, log warning)

### Agent File Placement
- [ ] When an agent places a file directly into an `assets/` folder (via filesystem), the file watcher (EPIC-31) detects it
- [ ] A `FileAttachment` record is created automatically for the new file:
  - `fileName`: original filename
  - `fileSize`: from filesystem stat
  - `mimeType`: detected from file extension
  - `storagePath`: relative path from MIRROR_DIR
  - `status`: READY
- [ ] The page's content is NOT modified — the file is available but not yet linked in the document
- [ ] An agent that also modifies the `.md` file to add a reference (`![](./assets/newfile.png)`) triggers the deserializer, which links the file

### Page Move — Assets Follow
- [ ] When a page is moved in the hierarchy (parent change), the `assets/` folder moves with it
- [ ] All relative paths in the `.md` content remain valid (they're relative, so they don't change)
- [ ] `FileAttachment.storagePath` records are updated to reflect the new location
- [ ] `.skb-meta.json` fileMap is updated

### Page Delete — Assets Cleaned Up
- [ ] When a page is deleted, its `assets/` folder and all contained files are deleted from disk
- [ ] Corresponding `FileAttachment` records are deleted (or the existing `onDelete: SetNull` cascade on `pageId` handles this)
- [ ] `Tenant.storageUsed` is decremented by the total size of deleted files

### MIME Type Detection from Extension
- [ ] When files are placed by agents (no upload API, so no Content-Type header), MIME type is inferred from extension:
  - `.png` → `image/png`, `.jpg`/`.jpeg` → `image/jpeg`, `.gif` → `image/gif`
  - `.pdf` → `application/pdf`, `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `.mp4` → `video/mp4`, `.mp3` → `audio/mpeg`
  - Unknown → `application/octet-stream`

---

## Architecture Overview

```
Serialization (DB → .md file):
──────────────────────────────

Page JSON content:
  {
    "type": "image",
    "attrs": {
      "src": "/api/files/attachment-uuid-123",
      "data-attachment-id": "attachment-uuid-123"
    }
  }
        │
        ▼
Serializer checks: does this image have an attachmentId?
  YES → Look up FileAttachment → get storagePath
      → Compute relative path from .md location to asset file
      → Emit: ![alt](./assets/a1b2c3-architecture.png)
  NO  → It's an external URL
      → Emit: ![alt](https://example.com/image.png)


Deserialization (.md file → DB):
────────────────────────────────

Markdown content:
  ![Architecture](./assets/a1b2c3-architecture.png)
        │
        ▼
Deserializer detects relative path (starts with ./ or ../)
  → Resolve against .md file location
  → Look up FileAttachment by storagePath
  → If found: set src = /api/files/{attachmentId}, set data-attachment-id
  → If not found but file exists on disk:
    → Create new FileAttachment record
    → Set src = /api/files/{newAttachmentId}
  → If file doesn't exist: leave path as-is, log warning


Agent Places File in assets/:
─────────────────────────────

Agent writes: data/mirror/tenant/Projects/assets/newdiagram.png
        │
        ▼
File watcher (EPIC-31 chokidar) detects new file in assets/ folder
        │
        ▼
AssetWatcher handler:
  1. Determine which page owns this assets/ folder
     (from .skb-meta.json fileMap, find the page whose .md is in the parent dir)
  2. Detect MIME type from file extension
  3. Get file size from fs.stat()
  4. Create FileAttachment record
  5. Update Tenant.storageUsed
  6. Log: "New asset registered: newdiagram.png for page 'Projects'"
        │
        ▼
File is now available at /api/files/{attachmentId}
Page content NOT modified (agent must edit .md to add inline reference)


Page Move — Assets Follow:
──────────────────────────

Page "Alpha" moved from "Projects" to "Archive":
  Before: data/mirror/tenant/Projects/Alpha.md
          data/mirror/tenant/Projects/Alpha/assets/diagram.png
  After:  data/mirror/tenant/Archive/Alpha.md
          data/mirror/tenant/Archive/Alpha/assets/diagram.png

Steps:
  1. SyncService moves .md file (EPIC-31)
  2. SyncService moves assets/ folder (this story adds this logic)
  3. Update FileAttachment.storagePath for all affected files
  4. Relative paths in .md content remain valid (./assets/diagram.png unchanged)
```

---

## Implementation Steps

### Step 1: Extend Markdown Serializer for Relative Paths

**File: `src/lib/markdown/serializer.ts`** (modify)

- In the image serialization handler:
  - Check if the image has a `data-attachment-id` attribute
  - If yes: look up FileAttachment, compute relative path from .md location, emit relative URL
  - If no: emit the src URL as-is (external URL)
- Add a new handler for `fileBlock` node type:
  - Emit as: `[filename (size)](./assets/filename)`

### Step 2: Extend Markdown Deserializer for Relative Path Resolution

**File: `src/lib/markdown/deserializer.ts`** (modify)

- In the image/link deserialization handler:
  - Detect relative paths (start with `./` or do not start with `http`)
  - Resolve the relative path against the .md file's directory
  - Look up FileAttachment by storagePath
  - If found: set the attachment attributes on the TipTap node
  - If not found but file exists: create FileAttachment record, then set attributes

### Step 3: Create Asset Watcher Handler

**File: `src/lib/sync/AssetWatcher.ts`** (create)

```typescript
export class AssetWatcher {
  /**
   * Called when a new file appears in an assets/ folder.
   * Creates a FileAttachment record without modifying page content.
   */
  async onAssetAdded(filePath: string, tenantId: string): Promise<void>;

  /**
   * Called when a file is deleted from an assets/ folder.
   * Removes the FileAttachment record and updates storage quota.
   */
  async onAssetDeleted(filePath: string, tenantId: string): Promise<void>;

  /**
   * Resolve which page owns an assets/ folder based on the path.
   */
  resolvePageForAssetPath(assetPath: string, metaJson: MetaJson): string | null;
}
```

### Step 4: Add MIME Type Detection from Extension

**File: `src/lib/storage/mimeDetection.ts`** (create)

```typescript
const EXTENSION_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  // ... etc
};

export function detectMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_MAP[ext] || 'application/octet-stream';
}
```

### Step 5: Add Asset Move Logic to Sync Service

**File: `src/lib/sync/SyncService.ts`** (modify — extends EPIC-31)

- In the `onPageMoved` handler:
  - After moving the .md file, also move the `assets/` folder
  - Update all `FileAttachment.storagePath` records for the moved page
  - Update `.skb-meta.json`

### Step 6: Add Asset Cleanup on Page Delete

**File: `src/lib/sync/SyncService.ts`** (modify — extends EPIC-31)

- In the `onPageDeleted` handler:
  - After deleting the .md file, also delete the `assets/` folder recursively
  - Sum up file sizes of all deleted FileAttachments
  - Decrement `Tenant.storageUsed` by total

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/lib/storage/mimeDetection.test.ts`**

- `.png` → `image/png`
- `.PDF` (uppercase) → `application/pdf`
- `.unknownext` → `application/octet-stream`
- No extension → `application/octet-stream`

**File: `src/__tests__/lib/sync/AssetWatcher.test.ts`**

- File added to `assets/` → FileAttachment created
- File deleted from `assets/` → FileAttachment removed, storage updated
- Resolve page for asset path → correct page ID returned
- Asset in unknown folder → null (no matching page)

**File: `src/__tests__/lib/markdown/serializer-assets.test.ts`**

- Image with attachment ID → relative path in .md
- Image without attachment ID (external URL) → absolute URL in .md
- FileBlock → `[filename (size)](./assets/...)` in .md

**File: `src/__tests__/lib/markdown/deserializer-assets.test.ts`**

- Relative path in .md → resolved to FileAttachment
- Relative path with no FileAttachment but file on disk → new record created
- Relative path with no file on disk → warning logged, path preserved

### Integration Tests (4+ cases)

- Upload file → serialize page → .md has relative path → deserialize → same attachment ID
- Agent places file in assets/ → FileAttachment created → serialize page with reference → renders in editor
- Move page → assets folder moves → relative paths still valid → serving URLs still work
- Delete page → assets folder deleted → FileAttachment records removed → storage decremented

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/storage/mimeDetection.ts` | Create | Extension-based MIME type detection |
| `src/lib/sync/AssetWatcher.ts` | Create | Handler for files placed in assets/ by agents |
| `src/lib/markdown/serializer.ts` | Modify | Emit relative paths for local attachments |
| `src/lib/markdown/deserializer.ts` | Modify | Resolve relative paths to FileAttachments |
| `src/lib/sync/SyncService.ts` | Modify | Move/delete assets with pages (EPIC-31 extension) |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
