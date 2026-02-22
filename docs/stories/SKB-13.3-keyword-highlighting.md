# Story SKB-13.3: Keyword Highlighting in Results

**Epic:** Epic 13 - Enhanced Search
**Story ID:** SKB-13.3
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-13.2 (API must return snippets with `<mark>` tags)

---

## User Story

As a user, I want matched keywords visually highlighted in search results, So that I can quickly see why each result matched my query and decide which result is most relevant.

---

## Acceptance Criteria

- [ ] `HighlightedText` component renders HTML snippets with `<mark>` tags safely
- [ ] Uses DOMPurify to sanitize HTML (only allows `<mark>` tags, strips everything else)
- [ ] Highlighted keywords styled with yellow background in light mode, dark yellow in dark mode
- [ ] Works in both page title and snippet preview
- [ ] Handles multiple highlighted terms (e.g., "postgresql setup" → both words highlighted)
- [ ] Handles partial matches (e.g., query "post" matches "postgresql")
- [ ] Accessible: highlighted text has `aria-label` describing the match
- [ ] TypeScript strict mode — no `any` types
- [ ] CSS classes use CSS custom properties for theme-aware colors
- [ ] Component is reusable across SearchResultCard and any other search UI

---

## Architecture Overview

```
Keyword Highlighting Flow
──────────────────────────

Server (ts_headline):
  "A guide to setup <mark>PostgreSQL</mark> on <mark>Linux</mark>"
              │
              ▼
Client (HighlightedText component):
  ┌────────────────────────────────────────────────┐
  │ 1. Receive HTML string with <mark> tags        │
  │ 2. Sanitize with DOMPurify (allow only <mark>) │
  │ 3. Render with dangerouslySetInnerHTML         │
  │ 4. Apply CSS styling to <mark> elements        │
  └────────────────────────────────────────────────┘
              │
              ▼
Rendered Output:
  A guide to setup [PostgreSQL] on [Linux]
                    ^^^^^^^^^     ^^^^^
                    highlighted   highlighted

CSS Styling:
  <mark> {
    background: var(--highlight-bg);
    color: var(--highlight-text);
    padding: 0.125rem 0.25rem;
    border-radius: 0.125rem;
  }

  Light mode:
    --highlight-bg: #fef08a (yellow-200)
    --highlight-text: var(--color-text-primary)

  Dark mode:
    --highlight-bg: #854d0e (yellow-800)
    --highlight-text: #fef9c3 (yellow-100)
```

---

## Implementation Steps

### Step 1: Create HighlightedText Component

Reusable component for rendering HTML with highlighted keywords.

**File: `src/components/search/HighlightedText.tsx`**

```typescript
'use client';

import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface HighlightedTextProps {
  /** HTML string with <mark> tags from ts_headline */
  html: string;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
}

/**
 * Renders HTML with highlighted keywords (<mark> tags).
 *
 * Sanitizes the HTML using DOMPurify to prevent XSS attacks.
 * Only allows <mark> tags — all other HTML is stripped.
 *
 * The <mark> elements are styled with:
 * - Yellow background in light mode
 * - Dark yellow background in dark mode
 * - Rounded corners and padding for visibility
 *
 * Usage:
 * ```tsx
 * <HighlightedText
 *   html="A guide to <mark>PostgreSQL</mark>"
 *   className="text-sm"
 * />
 * ```
 */
export function HighlightedText({
  html,
  className = '',
  'aria-label': ariaLabel,
}: HighlightedTextProps) {
  // Sanitize HTML: only allow <mark> tags
  const sanitized = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: [], // No attributes allowed
    });
  }, [html]);

  return (
    <span
      className={`
        ${className}
        [&_mark]:bg-yellow-200 [&_mark]:text-[var(--color-text-primary)]
        [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded
        dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100
      `}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      aria-label={ariaLabel}
    />
  );
}
```

---

### Step 2: Update SearchResultCard to Use HighlightedText

Replace the inline DOMPurify call with the HighlightedText component.

**File: `src/components/search/SearchResultCard.tsx`** (modify existing)

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { HighlightedText } from './HighlightedText';
import type { SearchResultItem } from '@/types/search';

interface SearchResultCardProps {
  result: SearchResultItem;
  isSelected: boolean;
  onSelect?: (pageId: string) => void;
  onHover?: () => void;
}

export function SearchResultCard({
  result,
  isSelected,
  onSelect,
  onHover,
}: SearchResultCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(result.pageId);
    } else {
      router.push(`/pages/${result.pageId}`);
    }
  }, [onSelect, result.pageId, router]);

  const formattedDate = result.updatedAt
    ? new Date(result.updatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <button
      role="option"
      aria-selected={isSelected}
      className={`
        w-full px-4 py-3 text-left cursor-pointer transition-colors duration-100
        border-b border-[var(--color-border)] last:border-b-0
        ${
          isSelected
            ? 'bg-[var(--color-bg-secondary)]'
            : 'hover:bg-[var(--color-bg-secondary)]'
        }
      `}
      onClick={handleClick}
      onMouseEnter={onHover}
    >
      {/* Header: icon, title, score */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex-shrink-0 text-lg">
          {result.pageIcon || '\u{1F4C4}'}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {/* Title may also contain highlights if title matches */}
          {result.pageTitle}
        </span>
        <span className="flex-shrink-0 text-xs font-semibold text-[var(--color-accent)]">
          {Math.round(result.score * 100)}%
        </span>
      </div>

      {/* Snippet with highlighted terms */}
      <HighlightedText
        html={result.snippet}
        className="block pl-8 text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-1.5"
        aria-label="Search result snippet"
      />

      {/* Footer: updated date */}
      {formattedDate && (
        <div className="pl-8 text-xs text-[var(--color-text-tertiary)]">
          Updated: {formattedDate}
        </div>
      )}
    </button>
  );
}
```

---

### Step 3: Add Highlighting to Page Titles (Optional Enhancement)

If the page title matches the query, highlight it too.

**File: `src/lib/search/query.ts`** (optional enhancement to existing code)

```typescript
// In enhancedSearchBlocks function, add ts_headline for page title:

const searchQuery = Prisma.sql`
  WITH ranked_blocks AS (
    SELECT
      p.id AS page_id,
      -- Highlight title if it matches
      CASE
        WHEN p.title ~* ${query} THEN
          ts_headline(
            'english',
            p.title,
            plainto_tsquery('english', ${query}),
            'StartSel=<mark>, StopSel=</mark>'
          )
        ELSE
          p.title
      END AS page_title,
      p.icon AS page_icon,
      p.updated_at,
      b.id AS block_id,
      ts_rank(b.search_vector, plainto_tsquery('english', ${query})) AS rank,
      ts_headline(
        'english',
        b.plain_text,
        plainto_tsquery('english', ${query}),
        'MaxFragments=2, MinWords=25, MaxWords=50, StartSel=<mark>, StopSel=</mark>'
      ) AS snippet
    FROM pages p
    JOIN blocks b ON b.page_id = p.id
    WHERE ${Prisma.raw(whereClause)}
  ),
  ...
`;
```

Then in SearchResultCard, also use HighlightedText for the title:

```typescript
<HighlightedText
  html={result.pageTitle}
  className="flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]"
  aria-label="Page title"
/>
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/search/HighlightedText.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighlightedText } from '@/components/search/HighlightedText';

describe('HighlightedText', () => {
  it('should render text with <mark> tags', () => {
    const html = 'A guide to <mark>PostgreSQL</mark> setup';
    const { container } = render(<HighlightedText html={html} />);

    const mark = container.querySelector('mark');
    expect(mark).toBeInTheDocument();
    expect(mark?.textContent).toBe('PostgreSQL');
  });

  it('should strip dangerous HTML tags', () => {
    const html = 'A guide <script>alert("xss")</script> to <mark>PostgreSQL</mark>';
    const { container } = render(<HighlightedText html={html} />);

    // Script should be stripped
    expect(container.querySelector('script')).not.toBeInTheDocument();

    // Mark should remain
    const mark = container.querySelector('mark');
    expect(mark).toBeInTheDocument();
  });

  it('should handle multiple highlighted terms', () => {
    const html = 'Setup <mark>PostgreSQL</mark> on <mark>Linux</mark>';
    const { container } = render(<HighlightedText html={html} />);

    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe('PostgreSQL');
    expect(marks[1].textContent).toBe('Linux');
  });

  it('should apply custom className', () => {
    const html = '<mark>test</mark>';
    const { container } = render(
      <HighlightedText html={html} className="text-sm text-red-500" />
    );

    const span = container.querySelector('span');
    expect(span?.className).toContain('text-sm');
    expect(span?.className).toContain('text-red-500');
  });

  it('should have aria-label for accessibility', () => {
    const html = '<mark>test</mark>';
    const { container } = render(
      <HighlightedText html={html} aria-label="Search snippet" />
    );

    const span = container.querySelector('span');
    expect(span?.getAttribute('aria-label')).toBe('Search snippet');
  });

  it('should handle empty string', () => {
    const { container } = render(<HighlightedText html="" />);
    expect(container.textContent).toBe('');
  });

  it('should handle plain text (no marks)', () => {
    const html = 'No highlights here';
    const { container } = render(<HighlightedText html={html} />);
    expect(container.textContent).toBe('No highlights here');
  });
});
```

### Visual Regression Test: `tests/e2e/search-highlighting.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search Result Highlighting', () => {
  test('should highlight matched keywords', async ({ page }) => {
    await page.goto('/');

    // Open search
    await page.keyboard.press('Meta+K');
    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('postgresql');

    // Wait for results
    await page.waitForTimeout(400);

    // Check that <mark> tags are present
    const marks = page.locator('mark');
    const count = await marks.count();
    expect(count).toBeGreaterThan(0);

    // Verify highlight styling (yellow background)
    const firstMark = marks.first();
    const bgColor = await firstMark.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );

    // RGB for yellow-200 in light mode
    // Exact value depends on theme, but should be yellowish
    expect(bgColor).toBeTruthy();
  });

  test('should highlight multiple keywords', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+K');
    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('postgresql linux');

    await page.waitForTimeout(400);

    // Both "postgresql" and "linux" should be highlighted
    const marks = page.locator('mark');
    const count = await marks.count();

    // Expect at least 2 highlights (could be more if words appear multiple times)
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should work in dark mode', async ({ page }) => {
    await page.goto('/');

    // Enable dark mode (assumes a theme toggle exists)
    await page.click('[aria-label="Toggle dark mode"]');

    await page.keyboard.press('Meta+K');
    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('test');

    await page.waitForTimeout(400);

    const firstMark = page.locator('mark').first();
    const bgColor = await firstMark.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );

    // Should have dark yellow background in dark mode
    expect(bgColor).toBeTruthy();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/search/HighlightedText.tsx` |
| MODIFY | `src/components/search/SearchResultCard.tsx` (use HighlightedText) |
| CREATE | `src/__tests__/components/search/HighlightedText.test.tsx` |
| CREATE | `tests/e2e/search-highlighting.spec.ts` |
| MODIFY (optional) | `src/lib/search/query.ts` (add title highlighting) |

---

## Dev Notes

### Challenges

1. **XSS prevention**: DOMPurify is critical. Without it, malicious content in page blocks could inject `<script>` tags into search results. The safest approach is to allow ONLY `<mark>` tags and strip everything else.

2. **Theme-aware colors**: Highlight colors must work in both light and dark modes. Using Tailwind's `dark:` prefix with CSS custom properties ensures consistency with the app's theme system.

3. **Partial match styling**: PostgreSQL `ts_headline` uses stemming, so "postgres" matches "postgresql". The highlight shows the exact matched substring, which is user-friendly.

4. **Accessibility**: Screen readers should announce highlighted text meaningfully. Consider adding `aria-label="Search result snippet with matched keywords"` to the container.

### Libraries

- `dompurify`: XSS sanitization (already in use)
- Tailwind CSS: Styling with `[&_mark]:` selector syntax

### Alternative Approaches

1. **Client-side highlighting**: Instead of using `ts_headline`, highlight on the client by parsing the query and wrapping matches in `<mark>` tags. This gives more control but requires reimplementing PostgreSQL's stemming logic.

2. **Custom highlight component**: Instead of `<mark>` tags, use a React component like `<Highlight>` that applies styles via props. This avoids `dangerouslySetInnerHTML` but requires parsing the HTML string.

For this story, server-side `ts_headline` + client-side sanitization is the simplest and most performant approach.

---

**Last Updated:** 2026-02-22
