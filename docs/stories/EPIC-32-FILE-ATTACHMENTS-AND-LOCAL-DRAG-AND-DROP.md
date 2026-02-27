# Epic 32: File Attachments & Local Drag-and-Drop

**Epic ID:** EPIC-32
**Created:** 2026-02-27
**Total Story Points:** 21
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 32 introduces **local file attachments with drag-and-drop support** in the SymbioKnowledgeBase editor. Users can drag files (images, PDFs, videos, documents) directly into a page. Files are stored on the local filesystem — inside the page's folder in the filesystem mirror (EPIC-31) — and linked inline in the document content. This is a **local-first** approach: the user's machine holds the actual files, with no cloud upload required.

### Why This Matters

1. **Local-First Ownership:** Files live on the user's machine. No cloud lock-in, no data privacy concerns, no storage fees. The user owns every byte.
2. **Agent-Friendly:** Agents browsing the filesystem mirror see files co-located with `.md` pages in `assets/` folders. They can add, reference, and organize files naturally.
3. **Seamless UX:** Drag-and-drop is the simplest file insertion workflow. No file picker dialogs, no URL pasting. Drop a diagram onto the page, it appears inline.
4. **Co-Location:** Files travel with their pages. Move a page in the hierarchy, its assets move too. Relative paths (`./assets/diagram.png`) never break.

### What Already Exists

- **FileAttachment model** (`prisma/schema.prisma:526-552`) — Full schema with `fileName`, `fileSize`, `mimeType`, `storagePath`, `storageUrl`, `status`, `checksum`, `metadata`. Status enum: `UPLOADING`, `PROCESSING`, `READY`, `FAILED`.
- **Storage quota tracking** — `Tenant.storageQuota` (5GB default) and `Tenant.storageUsed` fields exist.
- **ConfiguredImage extension** (`src/components/editor/extensions/imageBlock.ts`) — TipTap image node exists but only accepts external URLs. Comment on line 19: "File upload support can be added in a future iteration by handling paste/drop events."
- **Filesystem mirror** (EPIC-31) — Defines the folder structure with `assets/` subdirectories per page.
- **Markdown serializer/deserializer** — Already handles `![alt](url)` image syntax.

### What This Epic Adds

1. **Local file storage backend** — API to upload files, stored on local disk inside the mirror's `assets/` folder structure
2. **TipTap drag-and-drop extension** — Handle drag, drop, and paste events for files and images
3. **File block node** — New TipTap node type for non-image files (PDFs, documents, etc.)
4. **Inline rendering** — Images displayed inline, other files as rich preview cards with download
5. **Mirror integration** — Files placed in `assets/` folders, referenced with relative paths in `.md` files

**Out of scope (future — see note on EPIC-35):**
- Cloud upload/sync (S3, Supabase Storage) — local only for now
- Real-time collaborative file editing
- File versioning/history
- Thumbnail generation for non-image files

**Future consideration — EPIC-35 (Cloud Sync & Collaborative Sharing):**
When sharing functionality is needed, locally stored files will need to be synced to a cloud provider (e.g., Supabase Storage). The architecture in this epic is designed to make that transition straightforward: the `FileAttachment` model already has `storageUrl` for remote URLs, and the storage service can be extended with cloud backends without changing the editor or API interfaces.

**Dependencies:**
- TipTap editor with block content (done)
- EPIC-31 filesystem mirror folder structure (should be implemented first or in parallel)
- FileAttachment Prisma model (schema exists, no migration needed)
- Storage quota fields on Tenant (exist)

---

## Business Value

- **Content richness:** Users can embed images, diagrams, PDFs, and any file directly in their knowledge base pages — making it a true "second brain."
- **Agent integration:** Agents can place files in `assets/` folders and reference them in pages without any API calls — just filesystem operations.
- **Zero friction:** Drag-and-drop is the fastest way to add content. No upload dialogs, no URL hunting.
- **Data sovereignty:** Everything stays on the user's local machine. Full control, no third-party storage.

---

## Architecture Summary

```
File Upload Flow (Drag-and-Drop):
──────────────────────────────────

User drags file onto editor
        │
        ▼
1. TipTap drop handler intercepts DragEvent
2. Read File from event.dataTransfer.files
        │
        ▼
3. Validate file:
   - Check MIME type against allowlist
   - Check file size against limit (default: 50MB)
   - Check tenant storage quota
        │
        ▼
4. Upload to local API:
   POST /api/pages/{pageId}/attachments
   Content-Type: multipart/form-data
   Body: { file: File }
        │
        ▼
5. Server-side processing:
   a. Generate unique filename: {uuid}-{original-name}
   b. Determine storage path:
      data/mirror/{tenantId}/{page-folder}/assets/{filename}
   c. Write file to disk (streaming, not buffered)
   d. Create FileAttachment record in DB
   e. Update Tenant.storageUsed
   f. Return attachment metadata (id, path, url)
        │
        ▼
6. Insert node into editor:
   - Image files → ImageBlock node (src = serve URL)
   - Other files → FileBlock node (attachment metadata)
        │
        ▼
7. Auto-save triggers → Block content saved with attachment references


Storage Layout:
───────────────

data/mirror/{tenantId}/
├── Projects/
│   ├── _index.md
│   ├── assets/                    ← Assets for the Projects page
│   │   ├── a1b2c3-architecture.png
│   │   └── d4e5f6-requirements.pdf
│   ├── Alpha.md
│   └── Alpha/
│       └── assets/                ← Assets for the Alpha page
│           └── g7h8i9-mockup.figma
└── .skb-meta.json


File Serving:
─────────────

GET /api/files/{attachmentId}
  → Lookup FileAttachment by ID
  → Verify tenant access
  → Stream file from disk with correct Content-Type
  → Cache headers for browser caching

GET /api/files/{attachmentId}/thumbnail  (future)
  → Return thumbnail for supported types


Markdown Serialization:
───────────────────────

Image in .md file:
  ![Architecture Diagram](./assets/a1b2c3-architecture.png)

File block in .md file:
  [📎 requirements.pdf (2.4 MB)](./assets/d4e5f6-requirements.pdf)

Deserialization (reading .md):
  → Resolve relative paths back to FileAttachment records
  → Generate serving URLs for the editor
```

---

## Stories Breakdown

### SKB-32.1: Local File Storage Backend & Upload API — 5 points, High

**Delivers:** A file storage service that saves uploaded files to the local filesystem inside the mirror's `assets/` folders. Upload API endpoint with multipart handling, file validation, storage quota enforcement, and a file serving endpoint. Wires up the existing `FileAttachment` Prisma model.

**Depends on:** EPIC-31 mirror folder structure (or can create `assets/` folders independently)

---

### SKB-32.2: Editor Drag-and-Drop TipTap Extension — 8 points, High

**Delivers:** Full drag-and-drop and paste support in the TipTap editor. Handles image files (insert as ImageBlock), non-image files (insert as new FileBlock node), upload progress indicator, error handling, and multi-file drop. Extends the existing `ConfiguredImage` extension to support local uploads.

**Depends on:** SKB-32.1 (upload API must exist)

---

### SKB-32.3: Inline File Rendering & Preview — 5 points, Medium

**Delivers:** Rich rendering for all file types in the editor. Images display inline with lightbox zoom. PDFs show icon + filename + download link. Videos/audio use HTML5 players. Generic files show as styled cards with icon, name, size, and download button. Hover actions for download, delete, and rename.

**Depends on:** SKB-32.2 (FileBlock node must exist)

---

### SKB-32.4: Filesystem Mirror Asset Integration — 3 points, Medium

**Delivers:** Integration between file attachments and the filesystem mirror's Markdown files. Serializer emits relative paths (`./assets/filename`) for attachments. Deserializer resolves relative paths back to FileAttachment records. Files placed in `assets/` folders by agents are automatically registered as attachments. Asset folders move with pages.

**Depends on:** SKB-32.1, EPIC-31 SKB-31.3 (DB→FS sync)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 32.1 | File validation (type, size, quota); path generation; filename sanitization | Upload → file exists on disk → FileAttachment created; quota enforcement; file serving with correct MIME | N/A |
| 32.2 | Drop event parsing; file type detection; node insertion logic | Drop image → upload → image visible in editor; drop PDF → upload → file block visible; paste image | Drag file onto editor → appears inline |
| 32.3 | Render logic per MIME type; lightbox state; download URL generation | Image renders with correct src; PDF shows preview card; video shows player | Click image → lightbox opens |
| 32.4 | Relative path generation; path resolution; asset folder creation | Serialize page with image → .md has relative path; agent places file in assets/ → appears in editor | Move page → assets move → links still work |

---

## Implementation Order

```
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 32.1   │──▶│ 32.2   │──▶│ 32.3   │   │ 32.4   │
│Storage │   │Drag &  │   │Render  │   │Mirror  │
│Backend │   │Drop    │   │Preview │   │Integ.  │
└────────┘   └────────┘   └────────┘   └────────┘
     │                                      ▲
     └──────────────────────────────────────┘
     (32.4 also depends on 32.1)
```

---

## Shared Constraints

- **Local-First:** All files stored on the user's local filesystem. No cloud uploads in this epic.
- **Size Limits:** Default max file size: 50MB. Configurable via `MAX_FILE_SIZE` env var.
- **Allowed Types:** Default allowlist of common MIME types (images, PDFs, office docs, archives, audio, video). Configurable via `ALLOWED_FILE_TYPES` env var.
- **Storage Quota:** Enforce `Tenant.storageQuota` (default 5GB). Reject uploads that would exceed quota.
- **Atomic Writes:** Write files to temp location, then rename to final path to avoid partial files.
- **Streaming:** Large files streamed to disk, not buffered in memory.
- **Tenant Isolation:** Files stored under tenant-specific paths. No cross-tenant access.
- **Filename Safety:** Sanitize uploaded filenames. Prefix with UUID to avoid collisions.
- **TypeScript Strict:** No `any` types. Full type safety across all new files.

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/storage/LocalStorageService.ts` — File storage service (save, read, delete, stream)
- `src/lib/storage/fileValidation.ts` — MIME type checking, size validation, quota enforcement
- `src/lib/storage/types.ts` — Storage-related TypeScript types
- `src/lib/storage/config.ts` — Storage configuration (paths, limits, allowlists)
- `src/app/api/pages/[id]/attachments/route.ts` — Upload API (POST) + list attachments (GET)
- `src/app/api/files/[attachmentId]/route.ts` — File serving API (GET)
- `src/components/editor/extensions/FileBlockExtension.ts` — TipTap node for non-image files
- `src/components/editor/extensions/fileDropPlugin.ts` — TipTap plugin for drag-and-drop handling
- `src/components/editor/FileBlockView.tsx` — React component for file block rendering
- `src/components/editor/ImageLightbox.tsx` — Full-screen image viewer
- `src/components/editor/UploadProgress.tsx` — Upload progress indicator overlay
- Tests for all components

### Modified Files
- `src/components/editor/extensions/imageBlock.ts` — Enable local file uploads (remove URL-only restriction)
- `src/lib/editor/editorConfig.ts` — Register FileBlockExtension and fileDropPlugin
- `src/lib/markdown/serializer.ts` — Emit relative paths for local attachments
- `src/lib/markdown/deserializer.ts` — Resolve relative paths to FileAttachment records
- `prisma/schema.prisma` — No changes needed (model exists)
- `package.json` — Add `formidable` or `busboy` for multipart parsing (if needed)
- `.env.example` — Add `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES` variables

---

**Last Updated:** 2026-02-27
