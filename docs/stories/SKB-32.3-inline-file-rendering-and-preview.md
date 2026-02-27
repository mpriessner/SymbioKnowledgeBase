# Story SKB-32.3: Inline File Rendering & Preview

**Epic:** Epic 32 - File Attachments & Local Drag-and-Drop
**Story ID:** SKB-32.3
**Story Points:** 5 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-32.2 (FileBlock node must exist in editor)

---

## User Story

As a SymbioKnowledgeBase user, I want embedded files to display rich previews inline in my pages — images shown directly, PDFs with an icon and download link, videos with a player — so that I can quickly see and access my attached files without leaving the page.

---

## Acceptance Criteria

### Image Rendering
- [ ] Image files render inline at natural width (max 100% of editor width)
- [ ] Images are lazy-loaded (only fetch when scrolled into view)
- [ ] Click on an image opens a **lightbox** (full-screen overlay with zoom controls)
- [ ] Lightbox supports: zoom in/out, actual size, fit-to-screen, close (Escape key)
- [ ] Right-click context menu includes "Download image" option
- [ ] Broken images (file deleted from disk) show a placeholder with "Image not found"

### PDF Rendering
- [ ] PDF files show as a styled card:
  - File icon (PDF icon from lucide-react)
  - Filename (truncated with ellipsis if long)
  - File size (human-readable: "2.4 MB")
  - "Open" button (opens in new tab) + "Download" button
- [ ] Card has a subtle border and background matching the editor theme

### Video Rendering
- [ ] Video files (MP4, WebM) render as an HTML5 `<video>` player
- [ ] Player includes: play/pause, seek bar, volume, fullscreen
- [ ] Player is responsive (max-width: 100% of editor)
- [ ] Poster frame: first frame or a generic video icon

### Audio Rendering
- [ ] Audio files (MP3, WAV, OGG) render as an HTML5 `<audio>` player
- [ ] Player includes: play/pause, seek bar, volume, duration

### Generic File Rendering (All Other Types)
- [ ] Non-media files show as a styled card:
  - MIME-appropriate icon (FileText for docs, Archive for zip, File for unknown)
  - Filename
  - File size
  - MIME type label (e.g., "Microsoft Word Document")
  - "Download" button
- [ ] Card styling is consistent with PDF cards

### Hover Actions
- [ ] Hovering over any file block (image, PDF, video, audio, generic) shows a floating toolbar:
  - Download button
  - Delete button (with confirmation dialog)
  - Caption/alt-text edit (for images)
- [ ] Toolbar appears above the file block, auto-positioned to stay in viewport

### File Size Formatting
- [ ] Sizes displayed in human-readable format:
  - < 1 KB → "X bytes"
  - 1 KB - 1 MB → "X.X KB"
  - 1 MB - 1 GB → "X.X MB"
  - \> 1 GB → "X.X GB"

### Theme Support
- [ ] All file block styles support light and dark themes
- [ ] Icons use theme-appropriate colors

---

## Architecture Overview

```
FileBlock Rendering Decision Tree:
───────────────────────────────────

FileBlockView receives node attributes:
  { attachmentId, fileName, fileSize, mimeType, servingUrl }
        │
        ▼
  Determine render type from mimeType:
        │
        ├── image/* ──────────── → <ImageRenderer />
        │                          - <img> tag with lazy loading
        │                          - onClick → open Lightbox
        │                          - Error state → placeholder
        │
        ├── application/pdf ──── → <PdfRenderer />
        │                          - Styled card with PDF icon
        │                          - Open in new tab + Download
        │
        ├── video/* ──────────── → <VideoRenderer />
        │                          - HTML5 <video> element
        │                          - Controls, responsive
        │
        ├── audio/* ──────────── → <AudioRenderer />
        │                          - HTML5 <audio> element
        │                          - Compact player bar
        │
        └── (everything else) ── → <GenericFileRenderer />
                                   - Icon + name + size + download


Component Hierarchy:
────────────────────

FileBlockView (TipTap NodeView wrapper)
├── ImageRenderer
│   └── ImageLightbox (portal, full-screen overlay)
├── PdfRenderer
├── VideoRenderer
├── AudioRenderer
├── GenericFileRenderer
└── FileBlockToolbar (hover actions: download, delete, caption)
    └── DeleteConfirmDialog


Icon Mapping:
─────────────

mimeType → Icon:
  image/*                    → ImageIcon
  application/pdf            → FileText (red accent)
  application/msword         → FileText (blue accent)
  application/vnd.*sheet*    → Sheet (green accent)
  application/vnd.*present*  → Presentation (orange accent)
  application/zip            → Archive
  text/*                     → FileText
  audio/*                    → Music
  video/*                    → Video
  */*                        → File (default)
```

---

## Implementation Steps

### Step 1: Create MIME Type Utilities

**File: `src/lib/storage/mimeUtils.ts`** (create)

```typescript
export type FileRenderType = 'image' | 'pdf' | 'video' | 'audio' | 'generic';

export function getFileRenderType(mimeType: string): FileRenderType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'generic';
}

export function getFileIcon(mimeType: string): LucideIcon { /* ... */ }
export function getFileSizeLabel(bytes: number): string { /* ... */ }
export function getMimeTypeLabel(mimeType: string): string { /* ... */ }
```

### Step 2: Update FileBlockView with Render Type Routing

**File: `src/components/editor/FileBlockView.tsx`** (modify from SKB-32.2)

```typescript
export function FileBlockView({ node, selected }: NodeViewProps) {
  const { attachmentId, fileName, fileSize, mimeType, servingUrl } = node.attrs;
  const renderType = getFileRenderType(mimeType);

  return (
    <NodeViewWrapper className="file-block-wrapper">
      {renderType === 'image' && <ImageRenderer ... />}
      {renderType === 'pdf' && <PdfRenderer ... />}
      {renderType === 'video' && <VideoRenderer ... />}
      {renderType === 'audio' && <AudioRenderer ... />}
      {renderType === 'generic' && <GenericFileRenderer ... />}
      <FileBlockToolbar onDelete={...} onDownload={...} />
    </NodeViewWrapper>
  );
}
```

### Step 3: Create Image Renderer with Lightbox

**File: `src/components/editor/renderers/ImageRenderer.tsx`** (create)

```typescript
// Lazy-loaded image with error fallback
// onClick opens ImageLightbox
```

**File: `src/components/editor/ImageLightbox.tsx`** (create)

```typescript
// Full-screen overlay portal
// Features: zoom in/out, fit-to-screen, actual size, keyboard navigation
// Close: click outside, Escape key, close button
```

### Step 4: Create Media Renderers

**File: `src/components/editor/renderers/PdfRenderer.tsx`** (create)
**File: `src/components/editor/renderers/VideoRenderer.tsx`** (create)
**File: `src/components/editor/renderers/AudioRenderer.tsx`** (create)
**File: `src/components/editor/renderers/GenericFileRenderer.tsx`** (create)

### Step 5: Create Hover Toolbar

**File: `src/components/editor/FileBlockToolbar.tsx`** (create)

```typescript
// Floating toolbar appearing on hover over any file block
// Buttons: Download, Delete (with confirm dialog), Caption (images only)
// Positioned above the block, auto-adjusts to stay in viewport
```

### Step 6: Create Delete Confirmation Dialog

**File: `src/components/editor/DeleteFileDialog.tsx`** (create)

```typescript
// "Delete this file? This will remove it from the page and from storage."
// [Cancel] [Delete]
// On confirm: DELETE /api/files/{attachmentId} + remove node from editor
```

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/components/editor/renderers/*.test.tsx`**

- `getFileRenderType('image/png')` → `'image'`
- `getFileRenderType('application/pdf')` → `'pdf'`
- `getFileRenderType('video/mp4')` → `'video'`
- `getFileRenderType('audio/mpeg')` → `'audio'`
- `getFileRenderType('application/zip')` → `'generic'`
- `getFileSizeLabel(1024)` → `'1.0 KB'`
- `getFileSizeLabel(2457600)` → `'2.3 MB'`
- ImageRenderer renders `<img>` with correct src and lazy loading
- PdfRenderer renders card with filename and download button
- GenericFileRenderer renders card with correct icon for MIME type

### Integration Tests (4+ cases)

**File: `src/__tests__/integration/file-rendering.test.ts`**

- Insert image file block → renders as `<img>` in editor
- Insert PDF file block → renders as styled card
- Click image → lightbox opens → press Escape → closes
- Click delete on file block → confirmation dialog → confirm → block removed + file deleted

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/storage/mimeUtils.ts` | Create | MIME type detection, icons, labels |
| `src/components/editor/renderers/ImageRenderer.tsx` | Create | Inline image with lazy load |
| `src/components/editor/renderers/PdfRenderer.tsx` | Create | PDF preview card |
| `src/components/editor/renderers/VideoRenderer.tsx` | Create | HTML5 video player |
| `src/components/editor/renderers/AudioRenderer.tsx` | Create | HTML5 audio player |
| `src/components/editor/renderers/GenericFileRenderer.tsx` | Create | Generic file card |
| `src/components/editor/ImageLightbox.tsx` | Create | Full-screen image viewer |
| `src/components/editor/FileBlockToolbar.tsx` | Create | Hover action toolbar |
| `src/components/editor/DeleteFileDialog.tsx` | Create | Delete confirmation dialog |
| `src/components/editor/FileBlockView.tsx` | Modify | Add render type routing |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
