# Story SKB-14.3: Markdown API Endpoints

**Epic:** Epic 14 - Markdown Conversion Layer
**Story ID:** SKB-14.3
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-14.1 (serializer), SKB-14.2 (deserializer)

---

## User Story

As an API consumer, I want to read and write pages as markdown via query parameter or Accept header, So that I can integrate with markdown-based tools and LLM agents.

---

## Acceptance Criteria

### Read Endpoints

- [ ] `GET /api/pages/:id?format=markdown` — returns page as markdown with frontmatter
- [ ] `GET /api/pages/:id/export` — downloads page as `.md` file with proper Content-Disposition header
- [ ] `GET /api/pages/export?format=zip` — bulk export all tenant pages as zip of `.md` files
- [ ] Content-Type negotiation: `Accept: text/markdown` returns markdown, `Accept: application/json` returns JSON

### Write Endpoints

- [ ] `PUT /api/pages/:id?format=markdown` — accepts markdown body, converts to TipTap JSON, saves
- [ ] `POST /api/pages/import` — accepts `.md` file upload (FormData), creates page
- [ ] Validates markdown before saving (rejects invalid syntax with 400 + error details)
- [ ] Returns created/updated page as JSON response

### Security & Validation

- [ ] File size limit: 10MB max for markdown uploads
- [ ] Zip export: max 1000 pages, 100MB total
- [ ] Sanitizes HTML in markdown (DOMPurify on server)
- [ ] Tenant-scoped: all operations filtered by `tenant_id`
- [ ] Rate limiting: max 100 exports per hour per tenant

---

## Implementation

**File: `src/app/api/pages/[id]/route.ts` (modify existing)**

```typescript
export const GET = withTenant(async (req, ctx, routeCtx) => {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const accept = req.headers.get('accept');

  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId: ctx.tenantId },
    include: { blocks: true },
  });

  if (!page) return errorResponse('NOT_FOUND', 'Page not found', undefined, 404);

  // Return markdown if requested
  if (format === 'markdown' || accept?.includes('text/markdown')) {
    const markdown = await pageToMarkdown(page);
    return new Response(markdown, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  // Default JSON response
  return successResponse(page);
});

export const PUT = withTenant(async (req, ctx, routeCtx) => {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const contentType = req.headers.get('content-type');

  if (format === 'markdown' || contentType?.includes('text/markdown')) {
    const markdown = await req.text();
    const { content, metadata } = markdownToTiptap(markdown);

    // Update page with converted content
    await prisma.page.update({
      where: { id: pageId },
      data: {
        title: metadata.title || page.title,
        icon: metadata.icon || page.icon,
      },
    });

    await savePageBlocks(pageId, ctx.tenantId, content);

    return successResponse({ message: 'Page updated from markdown' });
  }

  // Default JSON handling...
});
```

**File: `src/app/api/pages/[id]/export/route.ts` (new)**

```typescript
export const GET = withTenant(async (req, ctx, routeCtx) => {
  const page = await fetchPageWithBlocks(pageId, ctx.tenantId);
  const markdown = await pageToMarkdown(page);

  const fileName = `${slugify(page.title)}.md`;

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
```

**File: `src/app/api/pages/export/route.ts` (new)**

```typescript
import JSZip from 'jszip';

export const GET = withTenant(async (req, ctx) => {
  const pages = await prisma.page.findMany({
    where: { tenantId: ctx.tenantId },
    include: { blocks: true },
    take: 1000, // Safety limit
  });

  const zip = new JSZip();

  // Build page hierarchy map: pageId → full folder path
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  function getPath(page: typeof pages[number]): string {
    const parts: string[] = [];
    let current: typeof pages[number] | undefined = page;
    while (current) {
      parts.unshift(slugify(current.title));
      current = current.parentId ? pageMap.get(current.parentId) : undefined;
    }
    return parts.join('/');
  }

  for (const page of pages) {
    const markdown = await pageToMarkdown(page);
    const folderPath = getPath(page);
    // Pages with children become folder/index.md, leaf pages become name.md
    const hasChildren = pages.some((p) => p.parentId === page.id);
    const filePath = hasChildren
      ? `${folderPath}/index.md`
      : `${folderPath}.md`;
    zip.file(filePath, markdown);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new Response(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="knowledge-base-export.zip"',
    },
  });
});
```

**Exported folder structure example:**

```
knowledge-base-export/
├── system-architecture/
│   ├── index.md              ← "System Architecture" page
│   ├── api-reference.md      ← child page
│   └── deployment-guide.md   ← child page
├── research-notes/
│   ├── index.md              ← "Research Notes" page
│   ├── ml-basics.md
│   └── rag-findings.md
├── meeting-notes-sprint-14.md ← top-level page (no children)
└── product-roadmap.md
```

**File: `src/app/api/pages/import/route.ts` (new)**

```typescript
export const POST = withTenant(async (req, ctx) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file || !file.name.endsWith('.md')) {
    return errorResponse('VALIDATION_ERROR', 'Invalid file type', undefined, 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('VALIDATION_ERROR', 'File too large (max 10MB)', undefined, 400);
  }

  const markdown = await file.text();
  const { content, metadata } = markdownToTiptap(markdown);

  const page = await prisma.page.create({
    data: {
      tenantId: ctx.tenantId,
      title: metadata.title || 'Untitled',
      icon: metadata.icon,
      parentId: metadata.parent,
    },
  });

  await savePageBlocks(page.id, ctx.tenantId, content);

  return successResponse(page, undefined, 201);
});
```

---

## Testing

```typescript
describe('Markdown API Endpoints', () => {
  it('should return markdown with format=markdown', async () => {
    const res = await fetch('/api/pages/123?format=markdown');
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const md = await res.text();
    expect(md).toContain('---'); // Frontmatter
  });

  it('should accept markdown PUT request', async () => {
    const markdown = '# Test Page\n\nContent here';
    const res = await fetch('/api/pages/123?format=markdown', {
      method: 'PUT',
      body: markdown,
      headers: { 'Content-Type': 'text/markdown' },
    });
    expect(res.ok).toBe(true);
  });

  it('should export page as .md file', async () => {
    const res = await fetch('/api/pages/123/export');
    expect(res.headers.get('content-disposition')).toContain('.md');
  });

  it('should import .md file', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['# Test\n\nContent'], { type: 'text/markdown' }), 'test.md');

    const res = await fetch('/api/pages/import', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(201);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/app/api/pages/[id]/route.ts` |
| CREATE | `src/app/api/pages/[id]/export/route.ts` |
| CREATE | `src/app/api/pages/export/route.ts` |
| CREATE | `src/app/api/pages/import/route.ts` |
| CREATE | `src/lib/markdown/helpers.ts` (pageToMarkdown, savePageBlocks utilities) |

---

**Last Updated:** 2026-02-22
