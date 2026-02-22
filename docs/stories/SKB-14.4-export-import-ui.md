# Story SKB-14.4: Export & Import UI

**Epic:** Epic 14 - Markdown Conversion Layer
**Story ID:** SKB-14.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-14.3 (API endpoints must exist)

---

## User Story

As a user, I want to export my pages as markdown files and import markdown files to create pages, So that I can back up my knowledge base and migrate content from other tools.

---

## Acceptance Criteria

### Export UI

- [ ] Settings page "Export" section with "Export All Pages" button
- [ ] Page menu (three-dot menu) "Export as Markdown" option for single page
- [ ] Export all → downloads zip file with all pages as `.md` files
- [ ] Export single → downloads single `.md` file
- [ ] Progress indicator for bulk export (shows "Exporting N of M pages...")
- [ ] Success toast: "Exported N pages successfully"

### Import UI

- [ ] Settings page "Import" section with file upload dropzone
- [ ] Drag-and-drop `.md` files onto sidebar → opens import dialog
- [ ] Import dialog shows: file name, preview of frontmatter (title, icon), estimated content size
- [ ] Confirmation: "Import this page?" with [Cancel] [Import] buttons
- [ ] Progress indicator for import: "Importing page..."
- [ ] Success: redirects to newly created page
- [ ] Error handling: shows validation errors (e.g., "Invalid markdown syntax on line 42")

### Bulk Import

- [ ] Drag-and-drop multiple `.md` files → batch import
- [ ] Progress: "Importing page 3 of 10..."
- [ ] Summary on completion: "Imported 8 pages. 2 failed." with error details

---

## Implementation

**File: `src/components/export/ExportDialog.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';

export function ExportDialog() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/pages/export?format=zip');
      const blob = await res.blob();
      downloadBlob(blob, 'knowledge-base-export.zip');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Export Pages</h3>
      <button
        onClick={handleExportAll}
        disabled={isExporting}
        className="btn-primary"
      >
        {isExporting ? 'Exporting...' : 'Export All Pages as Markdown'}
      </button>
    </div>
  );
}
```

**File: `src/components/import/ImportDialog.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';

export function ImportDialog() {
  const [files, setFiles] = useState<File[]>([]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'text/markdown': ['.md'] },
    onDrop: (acceptedFiles) => setFiles(acceptedFiles),
  });

  const handleImport = async () => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      await fetch('/api/pages/import', {
        method: 'POST',
        body: formData,
      });
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Import Pages</h3>
      <div {...getRootProps()} className="border-2 border-dashed p-8 text-center">
        <input {...getInputProps()} />
        <p>Drag and drop .md files here, or click to browse</p>
      </div>
      {files.length > 0 && (
        <button onClick={handleImport} className="btn-primary mt-4">
          Import {files.length} file(s)
        </button>
      )}
    </div>
  );
}
```

**Add to Page Menu: `src/components/page/PageMenu.tsx`**

```typescript
<MenuItem onClick={handleExport}>
  <DownloadIcon className="h-4 w-4" />
  Export as Markdown
</MenuItem>
```

---

## Testing

```typescript
test('should export page as markdown', async ({ page }) => {
  await page.goto('/pages/123');
  await page.click('[aria-label="Page menu"]');
  await page.click('text=Export as Markdown');

  // Wait for download
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/\.md$/);
});

test('should import markdown file', async ({ page }) => {
  await page.goto('/settings');
  await page.setInputFiles('input[type="file"]', 'test-page.md');
  await page.click('text=Import');

  // Should redirect to new page
  await expect(page).toHaveURL(/\/pages\/.+/);
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/export/ExportDialog.tsx` |
| CREATE | `src/components/import/ImportDialog.tsx` |
| MODIFY | `src/components/page/PageMenu.tsx` |
| MODIFY | `src/app/settings/page.tsx` |

---

**Last Updated:** 2026-02-22
