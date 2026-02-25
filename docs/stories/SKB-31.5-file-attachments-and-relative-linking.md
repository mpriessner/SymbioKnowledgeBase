# Story SKB-31.5: File Attachments & Relative Linking

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.5
**Story Points:** 5 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-31.3 (sync must be active to handle attachment references)

---

## User Story

As an AI agent or developer, I want to place files (images, PDFs, etc.) in a page's folder and have them automatically linked as attachments, and I want those links to use relative paths so they stay valid when I browse the file tree, So that I can manage page content and assets together as a cohesive unit.

---

## Acceptance Criteria

### Assets Folder Convention
- [ ] Each page can have an `assets/` subfolder for attachments
- [ ] Folder structure:
  ```
  Projects/
    _index.md              (the Projects page)
    assets/                (assets for the Projects page)
      diagram.png
      report.pdf
    Alpha.md               (child page)
    Alpha/
      assets/              (assets for the Alpha page)
        screenshot.png
  ```
- [ ] For leaf pages (no children), assets folder lives in a page-named subfolder:
  ```
  Welcome.md
  Welcome/
    assets/
      hero-image.png
  ```
- [ ] `assets/` folders are auto-created when an agent places a file there
- [ ] Empty `assets/` folders are cleaned up during sync

### Relative Path Linking
- [ ] Images in Markdown use relative paths: `![alt](./assets/image.png)` (from `_index.md`) or `![alt](./Welcome/assets/image.png)` (from same-level)
- [ ] Links to files: `[report](./assets/report.pdf)`
- [ ] The serializer generates relative paths based on the `.md` file location
- [ ] The deserializer resolves relative paths back to absolute/API URLs for the editor
- [ ] Paths use forward slashes on all platforms (normalized)

### Agent Workflow
- [ ] An agent can place a file in `data/mirror/{tenant}/Projects/assets/new-image.png`
- [ ] The file watcher detects the new file in `assets/`
- [ ] A `FileAttachment` record is created in the database linking to the page
- [ ] The file becomes accessible via the editor's image rendering
- [ ] The agent can then reference it in the `.md`: `![](./assets/new-image.png)`

### Page Move -> Link Update
- [ ] When a page is moved (parentId changes), if the page references assets:
  - The `assets/` folder moves with the `.md` file
  - Relative paths in the `.md` content remain valid (they're relative to the `.md` file)
  - No link rewriting needed for same-page assets
- [ ] When a page references assets from ANOTHER page (cross-page link):
  - Use absolute path from tenant root: `/Projects/assets/shared-diagram.png`
  - On page move, these cross-page links need updating

### FileAttachment Model Integration
- [ ] Wire the existing `FileAttachment` model (`prisma/schema.prisma:526-552`) to local file storage
- [ ] FileAttachment fields used:
  - `storagePath`: relative path in mirror directory
  - `url`: API URL for serving the file
  - `mimeType`: detected from file extension
  - `sizeBytes`: file size on disk
  - `status`: READY (local files are always ready)
  - `checksum`: SHA-256 of file content
- [ ] API endpoint to serve attachments: `GET /api/files/{attachmentId}` (streams file from disk)

### Supported File Types
- [ ] Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`
- [ ] Documents: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`
- [ ] Data: `.csv`, `.json`, `.xml`
- [ ] Text: `.txt`, `.md`, `.log`
- [ ] Max file size: 50MB per file (configurable)
- [ ] Unsupported types: executables (`.exe`, `.sh`, `.bat`) are ignored by the watcher

### Image Rendering in Editor
- [ ] When the editor loads a page with relative-path images, the paths resolve to the API endpoint
- [ ] Example: `![](./assets/image.png)` in Markdown -> `<img src="/api/files/{attachmentId}">` in editor
- [ ] Images display inline in the TipTap editor

---

## Architecture Overview

```
File Attachment Flow:
---------------------

Agent places file:
  data/mirror/{tenant}/Projects/assets/diagram.png
        |
        v
File watcher detects new file in assets/ folder
        |
        v
SyncService.onAssetAdded(filePath)
  1. Determine parent page: "Projects" (from folder path)
  2. Compute checksum (SHA-256)
  3. Detect MIME type from extension
  4. Create FileAttachment record in DB
  5. File stays on disk (no copy/move)
        |
        v
Agent edits Projects/_index.md:
  "![Architecture](./assets/diagram.png)"
        |
        v
Deserializer resolves relative path:
  "./assets/diagram.png" -> lookup FileAttachment by path
  -> Generate API URL: "/api/files/{attachmentId}"
  -> Store in ProseMirror image node: { src: "/api/files/{id}" }
        |
        v
Editor renders image from API URL


Path Resolution (Serializer):
-----------------------------

ProseMirror JSON:
  { type: "image", attrs: { src: "/api/files/abc123" } }
        |
        v
Serializer looks up FileAttachment by ID "abc123"
  -> storagePath: "Projects/assets/diagram.png"
  -> Current .md file: "Projects/_index.md"
  -> Relative path: "./assets/diagram.png"
        |
        v
Markdown:
  ![Architecture](./assets/diagram.png)
```

---

## Implementation Steps

### Step 1: Add Asset Watcher to FileWatcher

**File: `src/lib/sync/FileWatcher.ts`** (modify)

Add a separate watcher for `assets/` directories that creates FileAttachment records.

### Step 2: Create File Serving API

**File: `src/app/api/files/[id]/route.ts`** (create)

Serve files from the mirror directory by streaming from disk.

### Step 3: Implement Path Resolution in Serializer

**File: `src/lib/markdown/serializer.ts`** (modify)

When serializing image nodes, resolve API URLs to relative filesystem paths.

### Step 4: Implement Path Resolution in Deserializer

**File: `src/lib/markdown/deserializer.ts`** (modify)

When deserializing image references, resolve relative paths to API URLs.

### Step 5: Wire FileAttachment Model

Create/update FileAttachment records when files appear/disappear in `assets/` folders.

---

## Testing Requirements

### Unit Tests (8+ cases)

- Relative path generation from .md file to assets folder
- Path resolution: relative -> API URL
- Path resolution: API URL -> relative
- MIME type detection from extension
- File size validation (reject > 50MB)
- Checksum computation

### Integration Tests (6+ cases)

- Place image in assets/ -> FileAttachment created
- Reference in .md -> editor shows image
- Delete from assets/ -> FileAttachment removed
- Move page -> assets folder moves with it
- GET /api/files/{id} -> streams correct file
- Unsupported file type -> ignored

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sync/FileWatcher.ts` | Modify | Add assets watcher |
| `src/app/api/files/[id]/route.ts` | Create | File serving API |
| `src/lib/markdown/serializer.ts` | Modify | Relative path generation |
| `src/lib/markdown/deserializer.ts` | Modify | Relative path resolution |
| `src/lib/sync/attachments.ts` | Create | FileAttachment CRUD for local files |
| Tests | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25
