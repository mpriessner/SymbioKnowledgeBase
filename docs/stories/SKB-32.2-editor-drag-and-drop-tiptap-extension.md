# Story SKB-32.2: Editor Drag-and-Drop TipTap Extension

**Epic:** Epic 32 - File Attachments & Local Drag-and-Drop
**Story ID:** SKB-32.2
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-32.1 (upload API must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want to drag files from my desktop and drop them directly into the page editor, so that I can quickly add images, documents, and other files to my knowledge base pages without navigating file upload dialogs.

---

## Acceptance Criteria

### Drag-and-Drop Support
- [ ] Dragging a file over the editor shows a visual drop zone indicator (blue border + "Drop file here" overlay)
- [ ] Dropping a single image file (JPEG, PNG, GIF, WebP, SVG) inserts an **ImageBlock** at the drop position
- [ ] Dropping a single non-image file (PDF, DOCX, etc.) inserts a **FileBlock** at the drop position
- [ ] Dropping multiple files inserts them sequentially at the drop position
- [ ] Drop zone indicator disappears when file leaves the editor area

### Paste Support
- [ ] Pasting an image from clipboard (Ctrl+V / Cmd+V) inserts an **ImageBlock** at cursor position
- [ ] Pasting a file from clipboard inserts a **FileBlock** at cursor position
- [ ] Pasting text is unaffected (existing behavior preserved)

### Upload Progress
- [ ] During upload, a placeholder node shows at the insertion point:
  - For images: a blurred thumbnail (if available) with a progress bar overlay
  - For files: a card with filename, spinner, and progress percentage
- [ ] Progress updates in real-time (0% → 100%)
- [ ] On completion: placeholder replaced with final rendered node
- [ ] On failure: placeholder replaced with error card ("Upload failed — click to retry")

### FileBlock Node (New TipTap Node)
- [ ] A new `fileBlock` TipTap node type is registered in the editor schema
- [ ] Node attributes:
  - `attachmentId` (string) — FileAttachment record ID
  - `fileName` (string) — Original filename
  - `fileSize` (number) — Size in bytes
  - `mimeType` (string) — MIME type
  - `servingUrl` (string) — URL to fetch/download the file
- [ ] Node is block-level (own paragraph), not inline
- [ ] Node is selectable (click to select), deletable (backspace/delete)
- [ ] Node is NOT editable (content is fixed once uploaded)

### Image Upload Enhancement
- [ ] Modify existing `ConfiguredImage` extension to accept uploaded images (not just URLs)
- [ ] Set `allowBase64: false` (keep current setting — we use serving URLs, not base64)
- [ ] After upload, image `src` is set to `/api/files/{attachmentId}`

### Error Handling
- [ ] File validation errors (too large, wrong type, quota exceeded) show as toast notification
- [ ] Network errors during upload show retry option on the placeholder
- [ ] Multiple simultaneous uploads are supported (each has independent progress)

### Keyboard Accessibility
- [ ] File block is focusable via Tab key
- [ ] Enter on focused file block opens the file (navigates to serving URL)
- [ ] Delete/Backspace on focused file block removes it from the document

---

## Architecture Overview

```
Drag-and-Drop Event Flow:
─────────────────────────

1. User drags file over editor
        │
        ▼
   TipTap fileDropPlugin intercepts 'dragover' event
   → Sets drop zone visual state (CSS class on editor wrapper)
   → Calculates drop position (editor.view.posAtCoords)
        │
2. User drops file
        │
        ▼
   fileDropPlugin intercepts 'drop' event
   → event.preventDefault()
   → Read files from event.dataTransfer.files
   → For each file:
     a. Validate file type and size (client-side pre-check)
     b. Determine node type:
        - Image MIME → will become ImageBlock
        - Other MIME → will become FileBlock
     c. Insert placeholder node at drop position
     d. Start upload via uploadFile(pageId, file)
        │
        ▼
3. Upload in progress
        │
   uploadFile(pageId, file):
     → POST /api/pages/{pageId}/attachments
     → Use XMLHttpRequest (not fetch) for progress events
     → Update placeholder node's progress attribute in real-time
        │
        ▼
4. Upload complete
        │
   onUploadSuccess(response):
     → Find placeholder node in document
     → Replace with final node:
       - ImageBlock: set src = response.servingUrl
       - FileBlock: set all attributes from response
     → Trigger auto-save
        │
4b. Upload failed
        │
   onUploadError(error):
     → Find placeholder node in document
     → Update to error state (show retry button)
     → Show toast with error message


Paste Event Flow:
─────────────────

1. User pastes (Ctrl+V / Cmd+V)
        │
        ▼
   fileDropPlugin intercepts 'paste' event
   → Check event.clipboardData.files
   → If files.length > 0 AND first item is an image:
     a. event.preventDefault() (don't paste as base64)
     b. Insert placeholder at cursor position
     c. Upload file via same uploadFile() flow
   → Else: let default paste handling proceed (text paste)


Node Types:
───────────

ImageBlock (existing, modified):
  <img src="/api/files/{attachmentId}"
       alt="filename.png"
       title="filename.png"
       data-attachment-id="{attachmentId}" />

FileBlock (new):
  <div data-type="fileBlock"
       data-attachment-id="{attachmentId}"
       data-file-name="requirements.pdf"
       data-file-size="2457600"
       data-mime-type="application/pdf"
       data-serving-url="/api/files/{attachmentId}">
  </div>

UploadPlaceholder (transient, never persisted):
  <div data-type="uploadPlaceholder"
       data-file-name="uploading.pdf"
       data-progress="45"
       data-status="uploading|error">
  </div>
```

---

## Implementation Steps

### Step 1: Create FileBlock TipTap Extension

**File: `src/components/editor/extensions/FileBlockExtension.ts`** (create)

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FileBlockView } from '../FileBlockView';

export const FileBlockExtension = Node.create({
  name: 'fileBlock',
  group: 'block',
  atom: true,      // Can't be split
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
      fileName: { default: '' },
      fileSize: { default: 0 },
      mimeType: { default: '' },
      servingUrl: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="fileBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'fileBlock' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileBlockView);
  },
});
```

### Step 2: Create Upload Placeholder Extension

**File: `src/components/editor/extensions/UploadPlaceholderExtension.ts`** (create)

```typescript
// Transient node that shows during upload
// Never serialized to JSON (filtered out on save)
// Attributes: fileName, progress (0-100), status (uploading|error), fileType (image|file)
```

### Step 3: Create File Drop Plugin

**File: `src/components/editor/extensions/fileDropPlugin.ts`** (create)

```typescript
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const fileDropPluginKey = new PluginKey('fileDrop');

export function createFileDropPlugin(options: {
  pageId: string;
  onUploadStart: (file: File, pos: number) => void;
  onUploadProgress: (file: File, progress: number) => void;
  onUploadComplete: (file: File, result: UploadResult) => void;
  onUploadError: (file: File, error: Error) => void;
}): Plugin {
  return new Plugin({
    key: fileDropPluginKey,
    props: {
      handleDrop(view, event, slice, moved) {
        // 1. Check for files in event.dataTransfer
        // 2. Get drop position from coordinates
        // 3. For each file: validate, insert placeholder, start upload
        // Return true to prevent default handling
      },
      handlePaste(view, event) {
        // 1. Check for files in event.clipboardData
        // 2. If image file: prevent default, insert placeholder, upload
        // Return true if handled
      },
    },
  });
}
```

### Step 4: Create Upload Service (Client-Side)

**File: `src/lib/storage/uploadService.ts`** (create)

```typescript
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export function uploadFile(
  pageId: string,
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => { /* resolve with parsed response */ });
    xhr.addEventListener('error', () => { /* reject with error */ });

    xhr.open('POST', `/api/pages/${pageId}/attachments`);
    xhr.send(formData);
  });
}
```

### Step 5: Create FileBlock React View

**File: `src/components/editor/FileBlockView.tsx`** (create)

```typescript
// React component rendered by TipTap for fileBlock nodes
// Shows: file icon (based on MIME), filename, file size, download button
// Hover: highlight border
// Click: select node
// Double-click: open file (navigate to servingUrl)
```

### Step 6: Create Upload Progress Component

**File: `src/components/editor/UploadProgress.tsx`** (create)

```typescript
// React component for upload placeholder
// States: uploading (progress bar), error (retry button)
// For images: shows blurred preview thumbnail
// For files: shows file icon + name + progress bar
```

### Step 7: Modify ConfiguredImage Extension

**File: `src/components/editor/extensions/imageBlock.ts`** (modify)

```typescript
// Add data-attachment-id attribute
// Keep allowBase64: false
// Ensure src accepts /api/files/{id} URLs
```

### Step 8: Register Extensions in Editor Config

**File: `src/lib/editor/editorConfig.ts`** (modify)

```typescript
// Add FileBlockExtension to extensions array
// Add UploadPlaceholderExtension to extensions array
// Add fileDropPlugin to plugins
// Pass pageId to fileDropPlugin options
```

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/components/editor/fileDropPlugin.test.ts`**

- Drop event with image file → inserts placeholder → triggers upload
- Drop event with PDF file → inserts placeholder → triggers upload
- Drop event with multiple files → inserts multiple placeholders
- Paste event with clipboard image → inserts placeholder → triggers upload
- Paste event with text → default handling (no interception)
- Drop event with disallowed file type → shows toast error, no placeholder
- File over MAX_FILE_SIZE → shows toast error, no placeholder

**File: `src/__tests__/components/editor/FileBlockExtension.test.ts`**

- Node serializes to correct HTML attributes
- Node parses from HTML with correct attributes

### Integration Tests (4+ cases)

**File: `src/__tests__/integration/file-drag-drop.test.ts`**

- Drop image → upload completes → ImageBlock visible with correct src
- Drop PDF → upload completes → FileBlock visible with filename + size
- Upload fails (server error) → error placeholder shown → click retry → succeeds
- Paste image from clipboard → image appears in editor

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/editor/extensions/FileBlockExtension.ts` | Create | TipTap node for non-image files |
| `src/components/editor/extensions/UploadPlaceholderExtension.ts` | Create | Transient upload progress node |
| `src/components/editor/extensions/fileDropPlugin.ts` | Create | Drop and paste event handler plugin |
| `src/components/editor/FileBlockView.tsx` | Create | React view for file block rendering |
| `src/components/editor/UploadProgress.tsx` | Create | Upload progress placeholder component |
| `src/lib/storage/uploadService.ts` | Create | Client-side upload with XHR progress |
| `src/components/editor/extensions/imageBlock.ts` | Modify | Add attachment-id attribute support |
| `src/lib/editor/editorConfig.ts` | Modify | Register new extensions and plugin |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
