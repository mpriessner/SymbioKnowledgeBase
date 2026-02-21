# Story SKB-05.2: Wikilink TipTap Extension with Autocomplete

**Epic:** Epic 5 - Wikilinks & Backlinks
**Story ID:** SKB-05.2
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-05.1 (Wikilink parser must exist so links are indexed on save), SKB-04.1 (Block editor must be mounted)

---

## User Story

As a researcher, I want to type `[[` and see autocomplete suggestions for linking to other pages, So that I can quickly create connections between my knowledge pages.

---

## Acceptance Criteria

- [ ] Custom TipTap Node extension `WikilinkNode` with attrs: `{ pageId: string, pageName: string, displayText?: string }`
- [ ] Wikilink renders as clickable inline link with blue text styling
- [ ] Clicking a rendered wikilink navigates to the target page (`/pages/:pageId`)
- [ ] Typing `[[` triggers an autocomplete dropdown (floating popup)
- [ ] Autocomplete queries `GET /api/pages?search=term&limit=10` with 300ms debounce
- [ ] `WikilinkSuggestion.tsx`: floating dropdown showing page name matches with icons
- [ ] Keyboard navigation: arrow keys to select, Enter to insert, Escape to dismiss
- [ ] On selection: inserts `WikilinkNode` with resolved `pageId` and `pageName`
- [ ] Support for `[[Page Name|Display Text]]` pipe syntax — text after pipe becomes `displayText`
- [ ] Stored in TipTap JSON as `{ type: 'wikilink', attrs: { pageId, pageName, displayText } }`
- [ ] Wikilinks to deleted/non-existent pages render with broken-link visual (red text, dashed underline)
- [ ] Autocomplete popup positioned near cursor (floating UI)
- [ ] Empty state in autocomplete: "No pages found" with option to create new page
- [ ] TypeScript strict mode — all extension attributes fully typed

---

## Architecture Overview

```
User Interaction Flow
─────────────────────

  1. User types "See [["
     │
     ▼
  ┌──────────────────────────────────────────────────────┐
  │  TipTap Editor                                        │
  │                                                        │
  │  InputRule: detects "[[" sequence                      │
  │  → Activates WikilinkSuggestion plugin                │
  │  → Shows autocomplete popup                           │
  │                                                        │
  │  ┌────────────────────────────────────────────┐       │
  │  │  WikilinkSuggestion.tsx (floating popup)   │       │
  │  │                                             │       │
  │  │  Search input: "Inst" (typed after [[)      │       │
  │  │  ┌─────────────────────────────────────┐   │       │
  │  │  │ 📄 Installation Guide              │   │       │
  │  │  │ 📄 Installing Dependencies         │   │       │
  │  │  │ 📄 Instrument Calibration          │   │       │
  │  │  └─────────────────────────────────────┘   │       │
  │  │                                             │       │
  │  │  ↑↓ Navigate   Enter: Select   Esc: Close │       │
  │  └────────────────────────────────────────────┘       │
  │                                                        │
  └──────────────────────┬─────────────────────────────────┘
                         │
  2. User selects "Installation Guide"
     │
     ▼
  ┌──────────────────────────────────────────────────────┐
  │  WikilinkNode inserted into document                  │
  │                                                        │
  │  TipTap JSON:                                          │
  │  {                                                     │
  │    type: 'wikilink',                                   │
  │    attrs: {                                            │
  │      pageId: 'uuid-abc-123',                           │
  │      pageName: 'Installation Guide',                   │
  │      displayText: null                                 │
  │    }                                                   │
  │  }                                                     │
  │                                                        │
  │  Renders as: [Installation Guide] (blue, clickable)   │
  └──────────────────────────────────────────────────────┘

  3. User clicks the rendered wikilink
     │
     ▼
  ┌──────────────────────────────────────────────────────┐
  │  router.push('/pages/uuid-abc-123')                   │
  │  → Navigates to target page                           │
  └──────────────────────────────────────────────────────┘

Component Architecture
──────────────────────

  ┌─────────────────────────────────────┐
  │  BlockEditor.tsx                     │
  │                                      │
  │  extensions: [                       │
  │    StarterKit,                       │
  │    WikilinkExtension,  ◄─── NEW     │
  │    ...                               │
  │  ]                                   │
  └────────────┬────────────────────────┘
               │
  ┌────────────▼────────────────────────┐
  │  extensions/WikilinkExtension.ts     │
  │                                      │
  │  - TipTap Node extension             │
  │  - Defines node schema (attrs)       │
  │  - parseHTML / renderHTML             │
  │  - NodeView for React rendering      │
  └────────────┬────────────────────────┘
               │
  ┌────────────▼────────────────────────┐
  │  WikilinkNodeView.tsx                │
  │                                      │
  │  - React component for rendering     │
  │  - Blue text, clickable              │
  │  - Broken link styling if !exists    │
  └─────────────────────────────────────┘
               │
  ┌────────────▼────────────────────────┐
  │  WikilinkSuggestion.tsx              │
  │                                      │
  │  - Floating autocomplete popup       │
  │  - usePageSearch hook for API calls  │
  │  - Keyboard navigation              │
  │  - Positioned near editor cursor     │
  └─────────────────────────────────────┘

GET /api/pages?search=term&limit=10
─────────────────────────────────────

  Request:  GET /api/pages?search=Inst&limit=10
  Response: {
    data: [
      { id: 'uuid-1', title: 'Installation Guide', icon: '📄' },
      { id: 'uuid-2', title: 'Installing Dependencies', icon: '📄' },
    ],
    meta: { total: 2, limit: 10, offset: 0 }
  }
```

---

## Implementation Steps

### Step 1: Create the WikilinkExtension TipTap Node

This defines the wikilink as a custom inline node in TipTap with `pageId`, `pageName`, and `displayText` attributes.

**File: `src/components/editor/extensions/WikilinkExtension.ts`**

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { WikilinkNodeView } from '../WikilinkNodeView';

export interface WikilinkAttributes {
  pageId: string;
  pageName: string;
  displayText: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      /**
       * Insert a wikilink node at the current cursor position.
       */
      insertWikilink: (attrs: WikilinkAttributes) => ReturnType;
    };
  }
}

/**
 * TipTap Node extension for wikilinks.
 *
 * Renders inline wikilink nodes that store a reference to another page
 * by pageId. The node displays either the pageName or a custom displayText.
 *
 * Attributes:
 * - pageId: UUID of the target page
 * - pageName: Title of the target page (used for display and resolution)
 * - displayText: Optional custom display text (from [[Page|Custom]] syntax)
 */
export const WikilinkExtension = Node.create({
  name: 'wikilink',

  group: 'inline',

  inline: true,

  atom: true, // Cannot be split or partially selected

  selectable: true,

  draggable: false,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-page-id'),
        renderHTML: (attributes) => ({
          'data-page-id': attributes.pageId as string,
        }),
      },
      pageName: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-page-name'),
        renderHTML: (attributes) => ({
          'data-page-name': attributes.pageName as string,
        }),
      },
      displayText: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-display-text'),
        renderHTML: (attributes) => ({
          'data-display-text': attributes.displayText as string | null,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'wikilink',
        class: 'wikilink',
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikilinkNodeView);
  },

  addCommands() {
    return {
      insertWikilink:
        (attrs: WikilinkAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
```

---

### Step 2: Create the WikilinkNodeView React Component

This React component renders the wikilink node inside the editor. It shows the display text as a clickable blue link and handles navigation.

**File: `src/components/editor/WikilinkNodeView.tsx`**

```typescript
'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * React NodeView for rendering wikilink nodes inside the TipTap editor.
 *
 * Displays the wikilink as a styled inline element:
 * - Blue text with underline for valid links
 * - Red text with dashed underline for broken links (deleted pages)
 * - Click navigates to the target page
 */
export function WikilinkNodeView({ node }: NodeViewProps) {
  const router = useRouter();
  const { pageId, pageName, displayText } = node.attrs as {
    pageId: string | null;
    pageName: string;
    displayText: string | null;
  };

  const [exists, setExists] = useState<boolean>(true);
  const label = displayText || pageName;

  // Check if the target page still exists
  useEffect(() => {
    if (!pageId) {
      setExists(false);
      return;
    }

    // Lightweight check — could be optimized with a cache
    fetch(`/api/pages/${pageId}`, { method: 'HEAD' })
      .then((res) => setExists(res.ok))
      .catch(() => setExists(false));
  }, [pageId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (pageId && exists) {
        router.push(`/pages/${pageId}`);
      }
    },
    [pageId, exists, router]
  );

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        onClick={handleClick}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleClick(e as unknown as React.MouseEvent);
        }}
        className={`
          cursor-pointer font-medium transition-colors duration-150
          ${
            exists
              ? 'text-blue-600 underline decoration-blue-300 hover:text-blue-800 hover:decoration-blue-500 dark:text-blue-400 dark:decoration-blue-600 dark:hover:text-blue-300'
              : 'text-red-500 line-through decoration-dashed cursor-not-allowed dark:text-red-400'
          }
        `}
        title={exists ? `Go to: ${pageName}` : `Page not found: ${pageName}`}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
```

---

### Step 3: Create the Page Search Hook

A TanStack Query hook that searches pages with debouncing for the autocomplete dropdown.

**File: `src/hooks/usePageSearch.ts`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface PageSearchResult {
  id: string;
  title: string;
  icon: string | null;
}

interface PageSearchResponse {
  data: PageSearchResult[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Custom hook for searching pages with debouncing.
 * Used by the wikilink autocomplete to find matching pages.
 *
 * @param searchTerm - The current search input
 * @param options.enabled - Whether the query should run (e.g., autocomplete is open)
 * @param options.debounceMs - Debounce delay in milliseconds (default: 300)
 * @param options.limit - Maximum number of results (default: 10)
 */
export function usePageSearch(
  searchTerm: string,
  options: {
    enabled?: boolean;
    debounceMs?: number;
    limit?: number;
  } = {}
) {
  const { enabled = true, debounceMs = 300, limit = 10 } = options;
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return useQuery<PageSearchResponse>({
    queryKey: ['pages', 'search', debouncedTerm, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedTerm,
        limit: String(limit),
      });

      const response = await fetch(`/api/pages?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to search pages');
      }

      return response.json() as Promise<PageSearchResponse>;
    },
    enabled: enabled && debouncedTerm.length > 0,
    staleTime: 10_000, // 10 seconds — pages don't change that often
    placeholderData: (prev) => prev, // Keep previous data while loading
  });
}
```

---

### Step 4: Create the WikilinkSuggestion Component

A floating autocomplete dropdown that appears when the user types `[[` and shows matching page suggestions.

**File: `src/components/editor/WikilinkSuggestion.tsx`**

```typescript
'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { usePageSearch } from '@/hooks/usePageSearch';

export interface WikilinkSuggestionRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface WikilinkSuggestionProps {
  /** The current search query (text typed after [[) */
  query: string;
  /** Callback when a page is selected from the dropdown */
  onSelect: (page: { id: string; title: string; icon: string | null }) => void;
  /** Callback when the suggestion popup should close */
  onClose: () => void;
}

/**
 * Floating autocomplete dropdown for wikilink page suggestions.
 *
 * Triggered when the user types [[ in the editor. Shows matching pages
 * with debounced search, keyboard navigation, and click selection.
 *
 * Keyboard controls:
 * - ArrowUp / ArrowDown: navigate suggestions
 * - Enter: select highlighted suggestion
 * - Escape: close dropdown
 */
export const WikilinkSuggestion = forwardRef<
  WikilinkSuggestionRef,
  WikilinkSuggestionProps
>(function WikilinkSuggestion({ query, onSelect, onClose }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = usePageSearch(query, {
    enabled: true,
    debounceMs: 300,
    limit: 10,
  });

  const pages = data?.data ?? [];

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [pages.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const selectPage = useCallback(
    (index: number) => {
      const page = pages[index];
      if (page) {
        onSelect({ id: page.id, title: page.title, icon: page.icon });
      }
    },
    [pages, onSelect]
  );

  // Expose keyboard handler to the TipTap suggestion plugin
  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? pages.length - 1 : prev - 1
        );
        return true;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev >= pages.length - 1 ? 0 : prev + 1
        );
        return true;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        selectPage(selectedIndex);
        return true;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return true;
      }

      return false;
    },
  }));

  return (
    <div
      className="z-50 w-72 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)]
                 bg-[var(--color-bg-primary)] shadow-lg"
      role="listbox"
      aria-label="Page suggestions"
    >
      {isLoading && (
        <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          Searching...
        </div>
      )}

      {!isLoading && pages.length === 0 && (
        <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          No pages found
          {query && (
            <span className="block mt-1 text-xs">
              Press Enter to create &quot;{query}&quot;
            </span>
          )}
        </div>
      )}

      <div ref={listRef}>
        {pages.map((page, index) => (
          <button
            key={page.id}
            role="option"
            aria-selected={index === selectedIndex}
            className={`
              w-full px-3 py-2 text-left text-sm flex items-center gap-2
              transition-colors duration-100 cursor-pointer
              ${
                index === selectedIndex
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
              }
            `}
            onClick={() => selectPage(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex-shrink-0 text-base">
              {page.icon || '\u{1F4C4}'}
            </span>
            <span className="truncate">{page.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
```

---

### Step 5: Create the Suggestion Plugin Configuration

Configure TipTap's suggestion utility to trigger the autocomplete on `[[` input.

**File: `src/components/editor/extensions/wikilinkSuggestionPlugin.ts`**

```typescript
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import {
  WikilinkSuggestion,
  type WikilinkSuggestionRef,
} from '../WikilinkSuggestion';

/**
 * Creates the suggestion plugin configuration for wikilink autocomplete.
 *
 * This plugin:
 * 1. Detects when the user types "[["
 * 2. Captures subsequent keystrokes as the search query
 * 3. Renders a floating popup with page suggestions
 * 4. On selection, inserts a wikilink node with the chosen page's ID
 *
 * Uses tippy.js for positioning the floating popup near the cursor.
 */
export function createWikilinkSuggestion(): Omit<
  SuggestionOptions,
  'editor'
> {
  return {
    char: '[[',
    allowSpaces: true,

    command: ({ editor, range, props }) => {
      const { id, title, icon } = props as {
        id: string;
        title: string;
        icon: string | null;
      };

      // Check for pipe syntax: "Page Name|Display Text"
      const queryText = editor.state.doc.textBetween(
        range.from + 2, // Skip the [[ chars
        range.to
      );

      const pipeIndex = queryText.indexOf('|');
      let displayText: string | null = null;

      if (pipeIndex > -1) {
        displayText = queryText.substring(pipeIndex + 1).trim() || null;
      }

      // Delete the [[ trigger text and query, replace with wikilink node
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertWikilink({
          pageId: id,
          pageName: title,
          displayText,
        })
        .run();
    },

    render: () => {
      let component: ReactRenderer<WikilinkSuggestionRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(WikilinkSuggestion, {
            props: {
              query: props.query,
              onSelect: (page: { id: string; title: string; icon: string | null }) => {
                props.command(page);
              },
              onClose: () => {
                popup?.[0]?.hide();
              },
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            offset: [0, 4],
          });
        },

        onUpdate(props: SuggestionProps) {
          component?.updateProps({
            query: props.query,
            onSelect: (page: { id: string; title: string; icon: string | null }) => {
              props.command(page);
            },
          });

          if (props.clientRect) {
            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          }
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }

          return component?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
```

---

### Step 6: Register the Extension in the Block Editor

Add the WikilinkExtension to the editor's extension list.

**File: `src/components/editor/BlockEditor.tsx` (modification)**

```typescript
import { WikilinkExtension } from './extensions/WikilinkExtension';
import Suggestion from '@tiptap/suggestion';
import { createWikilinkSuggestion } from './extensions/wikilinkSuggestionPlugin';

// In the useEditor configuration, add to extensions array:
const editor = useEditor({
  extensions: [
    StarterKit,
    // ... existing extensions ...
    WikilinkExtension.configure({
      suggestion: createWikilinkSuggestion(),
    }),
  ],
  // ... rest of config
});
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/editor/WikilinkExtension.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { WikilinkExtension } from '@/components/editor/extensions/WikilinkExtension';

describe('WikilinkExtension', () => {
  it('should have the correct name', () => {
    const extension = WikilinkExtension.create();
    expect(extension.name).toBe('wikilink');
  });

  it('should be an inline node', () => {
    const extension = WikilinkExtension.create();
    expect(extension.config.group).toBe('inline');
    expect(extension.config.inline).toBe(true);
  });

  it('should be atomic (non-splittable)', () => {
    const extension = WikilinkExtension.create();
    expect(extension.config.atom).toBe(true);
  });

  it('should define pageId, pageName, and displayText attributes', () => {
    const extension = WikilinkExtension.create();
    const attrs = extension.config.addAttributes?.call(extension);
    expect(attrs).toHaveProperty('pageId');
    expect(attrs).toHaveProperty('pageName');
    expect(attrs).toHaveProperty('displayText');
  });
});
```

### Unit Tests: `src/__tests__/components/editor/WikilinkNodeView.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WikilinkNodeView } from '@/components/editor/WikilinkNodeView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock fetch for page existence check
global.fetch = vi.fn().mockResolvedValue({ ok: true });

describe('WikilinkNodeView', () => {
  const defaultProps = {
    node: {
      attrs: {
        pageId: 'uuid-123',
        pageName: 'Test Page',
        displayText: null,
      },
    },
    // ... other NodeViewProps mocked as needed
  } as unknown as import('@tiptap/react').NodeViewProps;

  it('should render the page name as link text', () => {
    render(<WikilinkNodeView {...defaultProps} />);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('should render displayText when provided', () => {
    const props = {
      ...defaultProps,
      node: {
        attrs: {
          pageId: 'uuid-123',
          pageName: 'Test Page',
          displayText: 'Custom Display',
        },
      },
    } as unknown as import('@tiptap/react').NodeViewProps;

    render(<WikilinkNodeView {...props} />);
    expect(screen.getByText('Custom Display')).toBeInTheDocument();
  });

  it('should have blue text styling for existing pages', () => {
    render(<WikilinkNodeView {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('text-blue-600');
  });

  it('should be keyboard accessible', () => {
    render(<WikilinkNodeView {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('tabIndex', '0');
  });
});
```

### Unit Tests: `src/__tests__/components/editor/WikilinkSuggestion.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WikilinkSuggestion } from '@/components/editor/WikilinkSuggestion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the usePageSearch hook
vi.mock('@/hooks/usePageSearch', () => ({
  usePageSearch: vi.fn().mockReturnValue({
    data: {
      data: [
        { id: 'id-1', title: 'Installation Guide', icon: null },
        { id: 'id-2', title: 'Installing Docker', icon: null },
      ],
    },
    isLoading: false,
  }),
}));

const queryClient = new QueryClient();

function renderWithQueryClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('WikilinkSuggestion', () => {
  const defaultProps = {
    query: 'Install',
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  it('should render matching pages', () => {
    renderWithQueryClient(<WikilinkSuggestion {...defaultProps} />);
    expect(screen.getByText('Installation Guide')).toBeInTheDocument();
    expect(screen.getByText('Installing Docker')).toBeInTheDocument();
  });

  it('should call onSelect when a page is clicked', () => {
    renderWithQueryClient(<WikilinkSuggestion {...defaultProps} />);
    fireEvent.click(screen.getByText('Installation Guide'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith({
      id: 'id-1',
      title: 'Installation Guide',
      icon: null,
    });
  });

  it('should show "No pages found" when no results', () => {
    vi.mocked(require('@/hooks/usePageSearch').usePageSearch).mockReturnValueOnce({
      data: { data: [] },
      isLoading: false,
    });

    renderWithQueryClient(<WikilinkSuggestion {...defaultProps} />);
    expect(screen.getByText('No pages found')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(require('@/hooks/usePageSearch').usePageSearch).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });

    renderWithQueryClient(<WikilinkSuggestion {...defaultProps} />);
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });
});
```

### E2E Test: `tests/e2e/wikilinks.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Wikilink Autocomplete', () => {
  test('should show autocomplete when typing [[', async ({ page }) => {
    await page.goto('/pages/test-page-id');

    // Focus the editor
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();

    // Type [[ to trigger autocomplete
    await editor.type('[[');

    // Autocomplete popup should appear
    const popup = page.locator('[role="listbox"]');
    await expect(popup).toBeVisible();
  });

  test('should insert wikilink on selection', async ({ page }) => {
    await page.goto('/pages/test-page-id');

    const editor = page.locator('[contenteditable="true"]');
    await editor.click();

    // Type [[ and a search term
    await editor.type('[[Install');

    // Wait for results
    const firstResult = page.locator('[role="option"]').first();
    await expect(firstResult).toBeVisible();

    // Click to select
    await firstResult.click();

    // Wikilink should be inserted (rendered as styled span)
    const wikilink = page.locator('[data-type="wikilink"]');
    await expect(wikilink).toBeVisible();
  });

  test('should navigate to target page on click', async ({ page }) => {
    await page.goto('/pages/source-page-id');

    // Find an existing wikilink in the page
    const wikilink = page.locator('[data-type="wikilink"]').first();

    if (await wikilink.isVisible()) {
      await wikilink.click();
      // Should navigate to the target page
      await expect(page).toHaveURL(/\/pages\//);
    }
  });
});
```

### Manual Verification Checklist

```bash
# 1. Open a page in the editor
# 2. Type [[ — autocomplete popup should appear
# 3. Type a few characters — results should filter
# 4. Use arrow keys to navigate, Enter to select — wikilink inserted
# 5. Click the inserted wikilink — navigate to target page
# 6. Delete the target page — wikilink should show broken link styling
# 7. Type [[Page Name|Custom Display]] — displayText should be "Custom Display"
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/editor/extensions/WikilinkExtension.ts` |
| CREATE | `src/components/editor/WikilinkNodeView.tsx` |
| CREATE | `src/components/editor/WikilinkSuggestion.tsx` |
| CREATE | `src/components/editor/extensions/wikilinkSuggestionPlugin.ts` |
| CREATE | `src/hooks/usePageSearch.ts` |
| MODIFY | `src/components/editor/BlockEditor.tsx` (register WikilinkExtension) |
| CREATE | `src/__tests__/components/editor/WikilinkExtension.test.ts` |
| CREATE | `src/__tests__/components/editor/WikilinkNodeView.test.tsx` |
| CREATE | `src/__tests__/components/editor/WikilinkSuggestion.test.tsx` |
| CREATE | `tests/e2e/wikilinks.spec.ts` |

---

**Last Updated:** 2026-02-21
