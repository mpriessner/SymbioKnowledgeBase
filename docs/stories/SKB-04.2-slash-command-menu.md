# Story SKB-04.2: Slash Command Menu

**Epic:** Epic 4 - Block Editor
**Story ID:** SKB-04.2
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-04.1 (TipTap Editor Integration with Basic Blocks)

---

## User Story

As a researcher, I want to type "/" to see a menu of block types, So that I can quickly insert any type of content.

---

## Acceptance Criteria

- [ ] Typing "/" at the start of a line or after a space opens a floating slash command menu
- [ ] Menu displays a list of available block types with icon, name, and description for each
- [ ] Menu filters results in real-time as user continues typing (e.g., "/hea" shows only heading items)
- [ ] Arrow keys navigate up/down through the menu items with visual highlight
- [ ] Enter key selects the highlighted item and inserts/converts the block
- [ ] Escape key closes the menu without making a selection
- [ ] Clicking a menu item selects it
- [ ] The "/" trigger character and filter text are removed after selection
- [ ] Menu is positioned near the cursor (floating below the current line)
- [ ] Menu scrolls if the list exceeds the visible height (max 300px)
- [ ] Block types in menu: Paragraph, Heading 1, Heading 2, Heading 3, Bulleted List, Numbered List, To-Do List, Toggle, Quote, Divider, Callout, Code Block, Image, Bookmark
- [ ] Empty filter (just "/") shows all block types
- [ ] No matches shows "No results" message
- [ ] Menu closes automatically if the cursor moves away from the trigger position
- [ ] Menu is keyboard-accessible and follows WAI-ARIA combobox patterns
- [ ] Implemented as a TipTap Suggestion extension

---

## Architecture Overview

```
TipTap Editor
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  User types "/"                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │  /hea|                                            │     │
│  └──────┬───────────────────────────────────────────┘     │
│         │                                                  │
│         │  Suggestion Plugin triggers                      │
│         ▼                                                  │
│  ┌──────────────────────────┐                              │
│  │  SlashMenu.tsx (floating) │                              │
│  │                            │                              │
│  │  ┌──────────────────────┐ │                              │
│  │  │ H1  Heading 1        │ │ ← highlighted (active)      │
│  │  │     Big section      │ │                              │
│  │  │     heading          │ │                              │
│  │  ├──────────────────────┤ │                              │
│  │  │ H2  Heading 2        │ │                              │
│  │  │     Medium section   │ │                              │
│  │  │     heading          │ │                              │
│  │  ├──────────────────────┤ │                              │
│  │  │ H3  Heading 3        │ │                              │
│  │  │     Small section    │ │                              │
│  │  │     heading          │ │                              │
│  │  └──────────────────────┘ │                              │
│  └──────────────────────────┘                              │
│                                                            │
└────────────────────────────────────────────────────────────┘

Data Flow:
┌────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Keypress  │────▶│  Suggestion      │────▶│  SlashMenu     │
│  "/" char   │     │  Extension       │     │  Component     │
└────────────┘     │                  │     │                │
                   │  - char: "/"     │     │  - Renders     │
                   │  - onStart()     │     │    filtered    │
                   │  - onChange()    │     │    items list  │
                   │  - onKeyDown()  │     │  - Handles     │
                   │  - onExit()     │     │    selection   │
                   └──────────────────┘     └────────┬───────┘
                                                      │
                                                      │ onSelect(item)
                                                      ▼
                                            ┌────────────────┐
                                            │  Editor        │
                                            │  Command       │
                                            │  (e.g.,        │
                                            │  setNode,      │
                                            │  toggleList,   │
                                            │  insertContent)│
                                            └────────────────┘
```

**Key Design Decisions:**

1. **TipTap Suggestion plugin:** The Suggestion plugin is TipTap's built-in mechanism for trigger-based menus (like @ mentions or / commands). It handles cursor tracking, filtering, and cleanup automatically.

2. **Block type registry:** All block types are defined in a central registry (`blockTypeRegistry.ts`) with metadata (name, description, icon, keywords, command). This makes adding new block types trivial and keeps the menu component data-driven.

3. **Floating UI positioning:** The menu uses the Suggestion plugin's built-in positioning which places the popup relative to the cursor using the `clientRect` callback.

---

## Implementation Steps

### Step 1: Create Block Type Registry

Define all available block types with their metadata. This registry is the single source of truth for both the slash menu and any future block insertion UI.

**File: `src/lib/editor/blockTypeRegistry.ts`**

```typescript
import type { Editor } from "@tiptap/react";

export interface BlockTypeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  keywords: string[];
  command: (editor: Editor) => void;
}

/**
 * Registry of all block types available in the slash command menu.
 * Each item defines how to insert/convert the block via editor commands.
 *
 * Keywords are used for fuzzy filtering — they include common
 * alternative names users might type.
 */
export const blockTypeRegistry: BlockTypeItem[] = [
  {
    id: "paragraph",
    name: "Paragraph",
    description: "Plain text block",
    icon: "Aa",
    keywords: ["paragraph", "text", "plain"],
    command: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
  },
  {
    id: "heading1",
    name: "Heading 1",
    description: "Big section heading",
    icon: "H1",
    keywords: ["heading", "h1", "title", "big"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading2",
    name: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    keywords: ["heading", "h2", "subtitle", "medium"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading3",
    name: "Heading 3",
    description: "Small section heading",
    icon: "H3",
    keywords: ["heading", "h3", "small"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
  },
  {
    id: "bulletList",
    name: "Bulleted List",
    description: "Unordered list with bullet points",
    icon: "UL",
    keywords: ["bullet", "list", "unordered", "ul"],
    command: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    id: "orderedList",
    name: "Numbered List",
    description: "Ordered list with numbers",
    icon: "OL",
    keywords: ["numbered", "list", "ordered", "ol", "number"],
    command: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    id: "taskList",
    name: "To-Do List",
    description: "List with checkboxes",
    icon: "CB",
    keywords: ["todo", "task", "checkbox", "check", "list"],
    command: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    id: "toggle",
    name: "Toggle",
    description: "Collapsible content block",
    icon: "TG",
    keywords: ["toggle", "collapse", "collapsible", "expand", "accordion"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "toggle",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Toggle heading" }],
            },
          ],
        })
        .run();
    },
  },
  {
    id: "blockquote",
    name: "Quote",
    description: "Capture a quotation",
    icon: "QT",
    keywords: ["quote", "blockquote", "citation"],
    command: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    id: "divider",
    name: "Divider",
    description: "Horizontal line to separate content",
    icon: "HR",
    keywords: ["divider", "horizontal", "rule", "line", "separator", "hr"],
    command: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
  {
    id: "callout",
    name: "Callout",
    description: "Highlighted information box",
    icon: "CO",
    keywords: ["callout", "info", "warning", "alert", "note", "tip"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { emoji: "💡", variant: "info" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "" }],
            },
          ],
        })
        .run();
    },
  },
  {
    id: "codeBlock",
    name: "Code Block",
    description: "Code with syntax highlighting",
    icon: "CD",
    keywords: ["code", "block", "syntax", "programming", "snippet"],
    command: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    id: "image",
    name: "Image",
    description: "Upload or embed an image",
    icon: "IM",
    keywords: ["image", "photo", "picture", "img", "upload"],
    command: (editor) => {
      // Prompt for URL — in SKB-04.5, this will open an image upload dialog
      const url = window.prompt("Enter image URL:");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    id: "bookmark",
    name: "Bookmark",
    description: "Save a link as a visual bookmark",
    icon: "BM",
    keywords: ["bookmark", "link", "embed", "url", "web"],
    command: (editor) => {
      const url = window.prompt("Enter URL:");
      if (url) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "bookmark",
            attrs: { url, title: "", description: "", favicon: "" },
          })
          .run();
      }
    },
  },
];

/**
 * Filter block types by a search query.
 * Matches against name, description, and keywords (case-insensitive).
 */
export function filterBlockTypes(query: string): BlockTypeItem[] {
  if (!query) return blockTypeRegistry;

  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return blockTypeRegistry;

  return blockTypeRegistry.filter((item) => {
    const searchFields = [
      item.name.toLowerCase(),
      item.description.toLowerCase(),
      ...item.keywords.map((k) => k.toLowerCase()),
    ];
    return searchFields.some((field) => field.includes(lowerQuery));
  });
}
```

---

### Step 2: Create the SlashMenu Component

The floating menu component that renders the filtered list of block types.

**File: `src/components/editor/SlashMenu.tsx`**

```tsx
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { BlockTypeItem } from "@/lib/editor/blockTypeRegistry";

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashMenuProps {
  items: BlockTypeItem[];
  command: (item: BlockTypeItem) => void;
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  function SlashMenu({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    // Expose keyboard handler to the Suggestion plugin
    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) =>
            prev <= 0 ? items.length - 1 : prev - 1
          );
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) =>
            prev >= items.length - 1 ? 0 : prev + 1
          );
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className="z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          data-testid="slash-menu"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No results
          </p>
        </div>
      );
    }

    return (
      <div
        className="z-50 max-h-[300px] w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        data-testid="slash-menu"
        role="listbox"
        aria-label="Block types"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? "bg-gray-100 dark:bg-gray-700"
                : "hover:bg-gray-50 dark:hover:bg-gray-750"
            }`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            role="option"
            aria-selected={index === selectedIndex}
            data-testid={`slash-menu-item-${item.id}`}
          >
            {/* Icon */}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-xs font-bold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {item.icon}
            </span>

            {/* Name and description */}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {item.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);
```

---

### Step 3: Create the TipTap Suggestion Extension

This extension wires TipTap's Suggestion plugin to the SlashMenu component.

**File: `src/components/editor/extensions/slashCommand.ts`**

```typescript
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  filterBlockTypes,
  type BlockTypeItem,
} from "@/lib/editor/blockTypeRegistry";
import { SlashMenu, type SlashMenuRef } from "@/components/editor/SlashMenu";

/**
 * Slash Command extension for TipTap.
 *
 * Triggers on "/" character and opens a floating menu of block types.
 * Uses TipTap's Suggestion plugin for cursor tracking and lifecycle,
 * ReactRenderer for rendering the React component, and Tippy.js
 * for floating positioning.
 */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: SuggestionProps["editor"];
          range: SuggestionProps["range"];
          props: BlockTypeItem;
        }) => {
          // Delete the "/" trigger and any filter text
          editor.chain().focus().deleteRange(range).run();
          // Execute the block type command
          props.command(editor);
        },
      } as Partial<SuggestionOptions<BlockTypeItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<BlockTypeItem>({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query }: { query: string }) => {
          return filterBlockTypes(query);
        },

        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps<BlockTypeItem>) => {
              component = new ReactRenderer(SlashMenu, {
                props: {
                  items: props.items,
                  command: (item: BlockTypeItem) => {
                    props.command(item);
                  },
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect:
                  props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                animation: "shift-away",
                maxWidth: "none",
              });
            },

            onUpdate: (props: SuggestionProps<BlockTypeItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: BlockTypeItem) => {
                  props.command(item);
                },
              });

              if (popup && props.clientRect) {
                popup[0]?.setProps({
                  getReferenceClientRect:
                    props.clientRect as () => DOMRect,
                });
              }
            },

            onKeyDown: (props: { event: KeyboardEvent }) => {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }

              return (
                component?.ref?.onKeyDown(props) ?? false
              );
            },

            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
```

---

### Step 4: Register the SlashCommand Extension in Editor Config

Update the editor configuration from SKB-04.1 to include the slash command extension.

**File: `src/lib/editor/editorConfig.ts`** (modification — add import and extension)

```typescript
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { SlashCommand } from "@/components/editor/extensions/slashCommand";
import type { Extensions } from "@tiptap/react";

const DEFAULT_PLACEHOLDER = "Type '/' for commands...";

export interface EditorConfigOptions {
  placeholder?: string;
}

export function getBaseExtensions(
  options: EditorConfigOptions = {}
): Extensions {
  const { placeholder = DEFAULT_PLACEHOLDER } = options;

  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
      history: {
        depth: 100,
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") {
          const level = node.attrs.level as number;
          return `Heading ${level}`;
        }
        return placeholder;
      },
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
    }),
    SlashCommand,
  ];
}
```

---

### Step 5: Install Tippy.js Dependency

The Suggestion plugin's render function uses Tippy.js for floating positioning. This must be added to the project dependencies.

```bash
npm install tippy.js
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/lib/editor/blockTypeRegistry.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  blockTypeRegistry,
  filterBlockTypes,
} from "@/lib/editor/blockTypeRegistry";

describe("blockTypeRegistry", () => {
  it("should contain all 14 block types", () => {
    expect(blockTypeRegistry).toHaveLength(14);
  });

  it("should have unique IDs for all block types", () => {
    const ids = blockTypeRegistry.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have non-empty name, description, icon, and keywords for all items", () => {
    blockTypeRegistry.forEach((item) => {
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.keywords.length).toBeGreaterThan(0);
      expect(typeof item.command).toBe("function");
    });
  });

  it("should include expected block types", () => {
    const names = blockTypeRegistry.map((item) => item.name);
    expect(names).toContain("Paragraph");
    expect(names).toContain("Heading 1");
    expect(names).toContain("Heading 2");
    expect(names).toContain("Heading 3");
    expect(names).toContain("Bulleted List");
    expect(names).toContain("Numbered List");
    expect(names).toContain("To-Do List");
    expect(names).toContain("Toggle");
    expect(names).toContain("Quote");
    expect(names).toContain("Divider");
    expect(names).toContain("Callout");
    expect(names).toContain("Code Block");
    expect(names).toContain("Image");
    expect(names).toContain("Bookmark");
  });
});

describe("filterBlockTypes", () => {
  it("should return all items when query is empty", () => {
    expect(filterBlockTypes("")).toHaveLength(14);
    expect(filterBlockTypes("  ")).toHaveLength(14);
  });

  it("should filter by name (case-insensitive)", () => {
    const results = filterBlockTypes("heading");
    expect(results.length).toBe(3);
    expect(results.map((r) => r.id)).toEqual([
      "heading1",
      "heading2",
      "heading3",
    ]);
  });

  it("should filter by partial name match", () => {
    const results = filterBlockTypes("hea");
    expect(results.length).toBe(3);
  });

  it("should filter by keywords", () => {
    const results = filterBlockTypes("checkbox");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("taskList");
  });

  it("should filter by description", () => {
    const results = filterBlockTypes("syntax");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("codeBlock");
  });

  it("should return empty array when no matches", () => {
    const results = filterBlockTypes("xyznonexistent");
    expect(results).toHaveLength(0);
  });

  it("should be case-insensitive", () => {
    const lower = filterBlockTypes("paragraph");
    const upper = filterBlockTypes("PARAGRAPH");
    const mixed = filterBlockTypes("ParaGraph");
    expect(lower).toEqual(upper);
    expect(upper).toEqual(mixed);
  });

  it("should match 'todo' keyword for To-Do List", () => {
    const results = filterBlockTypes("todo");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("To-Do List");
  });

  it("should match 'code' for Code Block", () => {
    const results = filterBlockTypes("code");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Code Block");
  });

  it("should match 'list' for multiple list types", () => {
    const results = filterBlockTypes("list");
    const names = results.map((r) => r.name);
    expect(names).toContain("Bulleted List");
    expect(names).toContain("Numbered List");
    expect(names).toContain("To-Do List");
  });
});
```

### Component Tests

**File: `tests/unit/components/editor/SlashMenu.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlashMenu } from "@/components/editor/SlashMenu";
import type { BlockTypeItem } from "@/lib/editor/blockTypeRegistry";

const mockItems: BlockTypeItem[] = [
  {
    id: "paragraph",
    name: "Paragraph",
    description: "Plain text block",
    icon: "Aa",
    keywords: ["paragraph", "text"],
    command: vi.fn(),
  },
  {
    id: "heading1",
    name: "Heading 1",
    description: "Big section heading",
    icon: "H1",
    keywords: ["heading", "h1"],
    command: vi.fn(),
  },
  {
    id: "heading2",
    name: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    keywords: ["heading", "h2"],
    command: vi.fn(),
  },
];

describe("SlashMenu", () => {
  it("should render all items", () => {
    const command = vi.fn();
    render(<SlashMenu items={mockItems} command={command} ref={null} />);

    expect(screen.getByText("Paragraph")).toBeDefined();
    expect(screen.getByText("Heading 1")).toBeDefined();
    expect(screen.getByText("Heading 2")).toBeDefined();
  });

  it("should render descriptions for each item", () => {
    const command = vi.fn();
    render(<SlashMenu items={mockItems} command={command} ref={null} />);

    expect(screen.getByText("Plain text block")).toBeDefined();
    expect(screen.getByText("Big section heading")).toBeDefined();
  });

  it("should render icons for each item", () => {
    const command = vi.fn();
    render(<SlashMenu items={mockItems} command={command} ref={null} />);

    expect(screen.getByText("Aa")).toBeDefined();
    expect(screen.getByText("H1")).toBeDefined();
    expect(screen.getByText("H2")).toBeDefined();
  });

  it("should call command when item is clicked", () => {
    const command = vi.fn();
    render(<SlashMenu items={mockItems} command={command} ref={null} />);

    fireEvent.click(screen.getByTestId("slash-menu-item-heading1"));
    expect(command).toHaveBeenCalledWith(mockItems[1]);
  });

  it("should show 'No results' when items array is empty", () => {
    const command = vi.fn();
    render(<SlashMenu items={[]} command={command} ref={null} />);

    expect(screen.getByText("No results")).toBeDefined();
  });

  it("should highlight first item by default", () => {
    const command = vi.fn();
    render(<SlashMenu items={mockItems} command={command} ref={null} />);

    const firstItem = screen.getByTestId("slash-menu-item-paragraph");
    expect(firstItem.getAttribute("aria-selected")).toBe("true");
  });

  it("should have correct ARIA attributes", () => {
    const command = vi.fn();
    render(<SlashMenu items={mockItems} command={command} ref={null} />);

    const menu = screen.getByTestId("slash-menu");
    expect(menu.getAttribute("role")).toBe("listbox");

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);
  });
});
```

### E2E Tests

**File: `tests/e2e/editor/slash-menu.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Slash Command Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should open slash menu when typing /", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/");

    const menu = page.locator('[data-testid="slash-menu"]');
    await expect(menu).toBeVisible();
  });

  test("should show all block types when just / is typed", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/");

    const menu = page.locator('[data-testid="slash-menu"]');
    await expect(menu).toBeVisible();

    // Should have multiple items
    const items = menu.locator('[role="option"]');
    await expect(items).toHaveCount(14);
  });

  test("should filter items as user types", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/hea");

    const menu = page.locator('[data-testid="slash-menu"]');
    const items = menu.locator('[role="option"]');
    await expect(items).toHaveCount(3); // H1, H2, H3
  });

  test("should show 'No results' for non-matching query", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/xyznonexistent");

    const menu = page.locator('[data-testid="slash-menu"]');
    await expect(menu).toContainText("No results");
  });

  test("should insert Heading 1 on selection", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/hea");

    // Select first item (Heading 1)
    await page.keyboard.press("Enter");

    // Type heading content
    await page.keyboard.type("My Heading");

    const heading = page.locator("h1");
    await expect(heading).toContainText("My Heading");
  });

  test("should navigate with arrow keys", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/");

    // Press down arrow to move to second item
    await page.keyboard.press("ArrowDown");

    // The second item should now be selected
    const secondItem = page.locator(
      '[data-testid="slash-menu-item-heading1"]'
    );
    await expect(secondItem).toHaveAttribute("aria-selected", "true");
  });

  test("should close on Escape", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/");

    const menu = page.locator('[data-testid="slash-menu"]');
    await expect(menu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });

  test("should insert bullet list from menu", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/bullet");
    await page.keyboard.press("Enter");
    await page.keyboard.type("List item");

    const listItem = page.locator("li");
    await expect(listItem).toContainText("List item");
  });

  test("should insert code block from menu", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/code");
    await page.keyboard.press("Enter");

    const codeBlock = page.locator("pre code");
    await expect(codeBlock).toBeVisible();
  });

  test("should remove / trigger text after selection", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("/heading");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Title");

    // The "/" and "heading" filter text should not appear in content
    await expect(editor).not.toContainText("/heading");
    await expect(editor).toContainText("Title");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/editor/blockTypeRegistry.ts` |
| CREATE | `src/components/editor/SlashMenu.tsx` |
| CREATE | `src/components/editor/extensions/slashCommand.ts` |
| MODIFY | `src/lib/editor/editorConfig.ts` (add SlashCommand extension) |
| MODIFY | `package.json` (add tippy.js dependency) |
| CREATE | `tests/unit/lib/editor/blockTypeRegistry.test.ts` |
| CREATE | `tests/unit/components/editor/SlashMenu.test.tsx` |
| CREATE | `tests/e2e/editor/slash-menu.spec.ts` |

---

**Last Updated:** 2026-02-21
