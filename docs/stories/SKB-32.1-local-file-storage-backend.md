# Story SKB-32.1: Local File Storage Backend & Upload API

**Epic:** Epic 32 - File Attachments & Local Drag-and-Drop
**Story ID:** SKB-32.1
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** EPIC-31 mirror folder structure (or can create `assets/` folders independently)

---

## User Story

As a SymbioKnowledgeBase user, I want to upload files to my pages and have them stored locally on my machine, so that I maintain full ownership of my data and can reference files directly from my knowledge base pages.

---

## Acceptance Criteria

### File Upload API
- [ ] `POST /api/pages/{pageId}/attachments` accepts `multipart/form-data` with a `file` field
- [ ] Returns JSON: `{ id, fileName, fileSize, mimeType, storagePath, servingUrl, status }`
- [ ] Files are streamed to disk (not buffered in memory) for large files
- [ ] Upload creates a `FileAttachment` record in the database with status `READY`
- [ ] Upload updates `Tenant.storageUsed` by the file size

### File Listing API
- [ ] `GET /api/pages/{pageId}/attachments` returns all attachments for a page
- [ ] Response includes: `id`, `fileName`, `fileSize`, `mimeType`, `servingUrl`, `createdAt`
- [ ] Sorted by `createdAt` descending (newest first)

### File Serving API
- [ ] `GET /api/files/{attachmentId}` streams the file from disk
- [ ] Sets correct `Content-Type` header based on `mimeType`
- [ ] Sets `Content-Disposition: inline` for viewable types (images, PDFs)
- [ ] Sets `Content-Disposition: attachment` for download types (zip, docx, etc.)
- [ ] Sets `Cache-Control: private, max-age=86400` for browser caching
- [ ] Returns 404 if file not found on disk or attachment record missing
- [ ] Returns 403 if requesting user's tenant doesn't match the file's tenant

### File Deletion API
- [ ] `DELETE /api/files/{attachmentId}` removes file from disk and database
- [ ] Updates `Tenant.storageUsed` (decrements by file size)
- [ ] Returns 404 if not found, 403 if wrong tenant

### Storage Path Convention
- [ ] Files stored at: `{MIRROR_DIR}/{tenantId}/{page-path}/assets/{uuid}-{sanitized-filename}`
- [ ] If MIRROR_DIR is not set, fall back to `data/files/{tenantId}/{pageId}/`
- [ ] `assets/` directory created automatically on first upload to a page
- [ ] UUID prefix prevents filename collisions
- [ ] Original filename sanitized: remove path traversal chars (`..`, `/`, `\`), limit to 200 chars

### File Validation
- [ ] Maximum file size: 50MB default (configurable via `MAX_FILE_SIZE` env var)
- [ ] Reject files exceeding tenant's remaining storage quota (`storageQuota - storageUsed`)
- [ ] MIME type allowlist (configurable via `ALLOWED_FILE_TYPES`):
  - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
  - Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-*`
  - Archives: `application/zip`, `application/gzip`, `application/x-tar`
  - Text: `text/plain`, `text/markdown`, `text/csv`
  - Audio: `audio/mpeg`, `audio/wav`, `audio/ogg`
  - Video: `video/mp4`, `video/webm`
- [ ] Return 413 (Payload Too Large) for size violations
- [ ] Return 415 (Unsupported Media Type) for disallowed MIME types
- [ ] Return 507 (Insufficient Storage) for quota violations

### Error Handling
- [ ] Partial uploads: if write fails mid-stream, delete the partial file
- [ ] DB record created only after file write completes successfully
- [ ] If DB write fails after file write, delete the file (compensating transaction)
- [ ] All errors return structured JSON: `{ error: string, code: string }`

---

## Architecture Overview

```
Upload Flow:
────────────

Client (multipart/form-data)
        │
        ▼
POST /api/pages/{pageId}/attachments
        │
        ▼
1. Authenticate user, resolve tenantId
2. Verify page exists and belongs to tenant
3. Parse multipart form (streaming, not buffered)
        │
        ▼
4. Validate:
   a. File size <= MAX_FILE_SIZE
   b. MIME type in allowlist
   c. Tenant quota: storageUsed + fileSize <= storageQuota
        │
        ▼
5. Generate storage path:
   basePath = resolvePageAssetPath(pageId, tenantId)
   filename = `${uuid()}-${sanitize(originalName)}`
   fullPath = `${basePath}/${filename}`
        │
        ▼
6. Stream file to disk:
   a. Create temp file: `${fullPath}.tmp`
   b. Pipe upload stream → write stream
   c. On complete: rename `.tmp` → final path (atomic)
   d. On error: delete `.tmp` file
        │
        ▼
7. Create FileAttachment record:
   {
     id: uuid,
     tenantId, userId, pageId,
     fileName: originalName,
     fileSize: bytes,
     mimeType: detected,
     storagePath: relativePath,
     status: READY
   }
        │
        ▼
8. Update Tenant.storageUsed:
   INCREMENT by fileSize
        │
        ▼
9. Return response:
   {
     id, fileName, fileSize, mimeType,
     servingUrl: `/api/files/${id}`,
     status: "READY"
   }


Path Resolution:
────────────────

resolvePageAssetPath(pageId, tenantId):
  1. If MIRROR_DIR is set AND .skb-meta.json exists:
     → Look up page's file path in fileMap
     → Derive folder: "Projects/Alpha" → "Projects/Alpha/assets/"
     → Return: `${MIRROR_DIR}/${tenantId}/Projects/Alpha/assets/`

  2. Else (mirror not active):
     → Return: `data/files/${tenantId}/${pageId}/`

  3. Create directory if it doesn't exist (mkdir -p)
```

---

## Implementation Steps

### Step 1: Create Storage Configuration

**File: `src/lib/storage/config.ts`** (create)

```typescript
export const MIRROR_DIR = process.env.MIRROR_DIR || '';
export const FALLBACK_FILES_DIR = process.env.FILES_DIR || 'data/files';
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || String(50 * 1024 * 1024)); // 50MB
export const ASSETS_DIRNAME = 'assets';

export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip', 'application/gzip', 'application/x-tar',
  // Text
  'text/plain', 'text/markdown', 'text/csv',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  // Video
  'video/mp4', 'video/webm',
]);
```

### Step 2: Create File Validation Module

**File: `src/lib/storage/fileValidation.ts`** (create)

```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: 'FILE_TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'QUOTA_EXCEEDED';
  httpStatus?: number;
}

export function validateFileUpload(
  fileSize: number,
  mimeType: string,
  tenantStorageUsed: bigint,
  tenantStorageQuota: bigint
): ValidationResult {
  // Check file size
  // Check MIME type against allowlist
  // Check storage quota
}

export function sanitizeFilename(name: string): string {
  // Remove path traversal characters
  // Remove special characters
  // Limit length to 200 chars
  // Handle empty result
}
```

### Step 3: Create Local Storage Service

**File: `src/lib/storage/LocalStorageService.ts`** (create)

```typescript
export class LocalStorageService {
  /**
   * Resolve the assets directory path for a page.
   * Uses mirror structure if available, falls back to flat structure.
   */
  async resolveAssetPath(pageId: string, tenantId: string): Promise<string>;

  /**
   * Save a file to disk. Uses atomic write (temp + rename).
   * Returns the relative storage path.
   */
  async saveFile(
    inputStream: ReadableStream | Buffer,
    targetDir: string,
    filename: string
  ): Promise<{ storagePath: string; bytesWritten: number }>;

  /**
   * Read a file from disk as a readable stream.
   */
  async readFile(storagePath: string): Promise<ReadableStream>;

  /**
   * Delete a file from disk.
   */
  async deleteFile(storagePath: string): Promise<void>;

  /**
   * Check if a file exists on disk.
   */
  async fileExists(storagePath: string): Promise<boolean>;
}
```

### Step 4: Create Upload API Endpoint

**File: `src/app/api/pages/[id]/attachments/route.ts`** (create)

```typescript
// POST — Upload file attachment
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Authenticate + resolve tenant
  // 2. Verify page exists
  // 3. Parse multipart form data
  // 4. Validate file (size, type, quota)
  // 5. Generate storage path
  // 6. Stream file to disk via LocalStorageService
  // 7. Create FileAttachment record
  // 8. Update Tenant.storageUsed
  // 9. Return attachment metadata
}

// GET — List page attachments
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Authenticate + resolve tenant
  // 2. Fetch FileAttachment records for page
  // 3. Return with serving URLs
}
```

### Step 5: Create File Serving Endpoint

**File: `src/app/api/files/[attachmentId]/route.ts`** (create)

```typescript
// GET — Serve file
export async function GET(req: NextRequest, { params }: { params: { attachmentId: string } }) {
  // 1. Lookup FileAttachment by ID
  // 2. Verify tenant access
  // 3. Stream file from disk
  // 4. Set Content-Type, Content-Disposition, Cache-Control headers
}

// DELETE — Remove file
export async function DELETE(req: NextRequest, { params }: { params: { attachmentId: string } }) {
  // 1. Lookup FileAttachment by ID
  // 2. Verify tenant access
  // 3. Delete file from disk
  // 4. Delete FileAttachment record
  // 5. Decrement Tenant.storageUsed
}
```

### Step 6: Create TypeScript Types

**File: `src/lib/storage/types.ts`** (create)

```typescript
export interface UploadResult {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  servingUrl: string;
  status: 'READY';
}

export interface AttachmentInfo {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  servingUrl: string;
  createdAt: string;
}
```

---

## Testing Requirements

### Unit Tests (10+ cases)

**File: `src/__tests__/lib/storage/fileValidation.test.ts`**

- Valid JPEG under 50MB → passes validation
- File over MAX_FILE_SIZE → returns FILE_TOO_LARGE with 413
- Unknown MIME type → returns UNSUPPORTED_TYPE with 415
- File that would exceed quota → returns QUOTA_EXCEEDED with 507
- File exactly at max size → passes
- File exactly at quota boundary → passes
- `sanitizeFilename("../../../etc/passwd")` → safe filename
- `sanitizeFilename("my file (1).pdf")` → `my file (1).pdf` (preserved)
- `sanitizeFilename("")` → `unnamed` fallback
- Very long filename → truncated to 200 chars

**File: `src/__tests__/lib/storage/LocalStorageService.test.ts`**

- `saveFile` creates file at correct path
- `saveFile` uses atomic write (temp + rename)
- `readFile` streams correct content
- `deleteFile` removes file from disk
- `resolveAssetPath` with mirror → returns mirror path
- `resolveAssetPath` without mirror → returns fallback path
- `resolveAssetPath` creates directory if missing

### Integration Tests (6+ cases)

**File: `src/__tests__/integration/file-upload.test.ts`**

- POST upload → file exists on disk → FileAttachment in DB → servingUrl works
- POST upload → Tenant.storageUsed incremented correctly
- POST upload exceeding quota → 507 response, no file on disk, no DB record
- GET list attachments → returns all files for page, sorted by createdAt
- GET serve file → correct Content-Type, file content matches original
- DELETE file → removed from disk, removed from DB, storageUsed decremented

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/storage/config.ts` | Create | Storage paths, limits, MIME allowlist |
| `src/lib/storage/types.ts` | Create | Storage-related TypeScript types |
| `src/lib/storage/fileValidation.ts` | Create | File validation (size, type, quota) |
| `src/lib/storage/LocalStorageService.ts` | Create | File CRUD on local filesystem |
| `src/app/api/pages/[id]/attachments/route.ts` | Create | Upload + list API |
| `src/app/api/files/[attachmentId]/route.ts` | Create | Serve + delete API |
| `.env.example` | Modify | Add MAX_FILE_SIZE, ALLOWED_FILE_TYPES, FILES_DIR |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
