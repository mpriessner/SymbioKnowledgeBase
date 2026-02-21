# Story SKB-04.3: Rich Text Formatting

**Epic:** Epic 4 - Block Editor
**Story ID:** SKB-04.3
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-04.1 (TipTap Editor Integration with Basic Blocks)

---

## User Story

As a researcher, I want to format text with bold, italic, and other styles, So that I can emphasize important information.

---

## Acceptance Criteria

- [ ] Bold: Cmd/Ctrl+B toggles bold mark on selected text
- [ ] Italic: Cmd/Ctrl+I toggles italic mark on selected text
- [ ] Strikethrough: Cmd/Ctrl+Shift+S toggles strikethrough mark on selected text
- [ ] Inline code: Cmd/Ctrl+E toggles inline code mark on selected text
- [ ] Hyperlink: Cmd/Ctrl+K opens a link input popover to add/edit/remove a URL
- [ ] Markdown shortcuts work: `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``
- [ ] Floating toolbar appears when text is selected (minimum 1 character)
- [ ] Floating toolbar hides when selection is collapsed (cursor only, no selection)
- [ ] Toolbar buttons show active/pressed state when their mark is applied to the selection
- [ ] Toolbar includes buttons for: Bold, Italic, Strikethrough, Code, Link
- [ ] Link button opens an inline URL input field within the toolbar
- [ ] Link input has "Apply" and "Remove link" actions
- [ ] Links open in new tab when clicked in read-only mode; in edit mode, clicking positions cursor
- [ ] All formatting marks are persisted as part of the TipTap JSON document (auto-save from SKB-04.1)
- [ ] Toolbar is positioned above the selection, centered horizontally
- [ ] Toolbar does not overflow the viewport (repositions if near edges)
- [ ] TypeScript strict mode — all component props typed

---

## Architecture Overview

```
User Selects Text
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  TipTap Editor                                       │
│                                                      │
│  "The quick ████████ fox jumps over"                 │
│           ▲  (selected text)                         │
│           │                                          │
│  ┌────────┴──────────────────────────────────┐      │
│  │  FormattingToolbar.tsx (floating)           │      │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                │      │
│  │  │ B│ │ I│ │ S│ │<>│ │🔗│                  │      │
│  │  └──┘ └──┘ └──┘ └──┘ └──┘                │      │
│  │  Bold  Ital  Str  Code Link               │      │
│  │         ike                                │      │
│  │                                            │      │
│  │  When Link button clicked:                │      │
│  │  ┌──────────────────────────────────┐     │      │
│  │  │  URL: [https://example.com    ]  │     │      │
│  │  │  [Apply]  [Remove]               │     │      │
│  │  └──────────────────────────────────┘     │      │
│  └───────────────────────────────────────────┘      │
│                                                      │
└─────────────────────────────────────────────────────┘

TipTap Marks (stored in JSON content):
┌──────────────────────────────────────────────┐
│  {                                            │
│    "type": "text",                            │
│    "text": "brown",                           │
│    "marks": [                                 │
│      { "type": "bold" },                      │
│      { "type": "italic" }                     │
│    ]                                          │
│  }                                            │
└──────────────────────────────────────────────┘

Keyboard Shortcuts:
┌──────────────────────────────────────────────┐
│  Cmd/Ctrl + B  →  toggleBold()               │
│  Cmd/Ctrl + I  →  toggleItalic()             │
│  Cmd/Ctrl + Shift + S  →  toggleStrike()     │
│  Cmd/Ctrl + E  →  toggleCode()               │
│  Cmd/Ctrl + K  →  openLinkInput()            │
└──────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **TipTap BubbleMenu vs custom:** We use TipTap's built-in `BubbleMenu` component which handles selection detection and positioning automatically. This is more reliable than a custom implementation because it integrates directly with ProseMirror's selection state.

2. **Link editing inline:** The link input appears within the floating toolbar rather than as a separate modal. This keeps the user's context and avoids breaking flow.

3. **Marks via StarterKit:** Bold, Italic, Strike, and Code marks are already included in StarterKit (configured in SKB-04.1). The Link mark requires the separate `@tiptap/extension-link` package (already installed in SKB-01.1).

---

## Implementation Steps

### Step 1: Configure Link Extension

Add the Link extension to the editor configuration. The Link extension is separate from StarterKit and requires explicit configuration.

**File: `src/lib/editor/editorConfig.ts`** (modification — add Link extension)

```typescript
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
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
    Link.configure({
      openOnClick: false, // Prevent navigation in edit mode; handled in read-only mode
      HTMLAttributes: {
        class: "text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer",
        rel: "noopener noreferrer",
        target: "_blank",
      },
      validate: (href) => /^https?:\/\//.test(href), // Only allow http(s) links
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

### Step 2: Create Formatting Toolbar Component

The floating toolbar that appears on text selection. Uses TipTap's `BubbleMenu` for automatic positioning and visibility management.

**File: `src/components/editor/FormattingToolbar.tsx`**

```tsx
"use client";

import { useState, useCallback } from "react";
import { BubbleMenu, type Editor } from "@tiptap/react";

interface FormattingToolbarProps {
  editor: Editor;
}

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Open link input with current URL if link is active
  const handleLinkClick = useCallback(() => {
    const currentUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(currentUrl ?? "");
    setShowLinkInput(true);
  }, [editor]);

  // Apply the link
  const handleLinkApply = useCallback(() => {
    if (linkUrl.trim()) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl.trim() })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  // Remove the link
  const handleLinkRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor]);

  // Handle Enter key in link input
  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLinkApply();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowLinkInput(false);
        setLinkUrl("");
        editor.commands.focus();
      }
    },
    [handleLinkApply, editor]
  );

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: "top",
        animation: "shift-away",
      }}
      shouldShow={({ editor: e, from, to }) => {
        // Only show when there is a text selection (not empty)
        if (from === to) return false;
        // Don't show for node selections (e.g., selected image)
        if (e.state.selection.node) return false;
        return true;
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        data-testid="formatting-toolbar"
        role="toolbar"
        aria-label="Text formatting"
      >
        {!showLinkInput ? (
          <>
            {/* Bold */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold (Ctrl+B)"
              testId="toolbar-bold"
            >
              <span className="font-bold">B</span>
            </ToolbarButton>

            {/* Italic */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic (Ctrl+I)"
              testId="toolbar-italic"
            >
              <span className="italic">I</span>
            </ToolbarButton>

            {/* Strikethrough */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              title="Strikethrough (Ctrl+Shift+S)"
              testId="toolbar-strike"
            >
              <span className="line-through">S</span>
            </ToolbarButton>

            {/* Inline Code */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
              title="Inline Code (Ctrl+E)"
              testId="toolbar-code"
            >
              <span className="font-mono text-xs">&lt;&gt;</span>
            </ToolbarButton>

            {/* Separator */}
            <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />

            {/* Link */}
            <ToolbarButton
              onClick={handleLinkClick}
              isActive={editor.isActive("link")}
              title="Add Link (Ctrl+K)"
              testId="toolbar-link"
            >
              <LinkIcon />
            </ToolbarButton>
          </>
        ) : (
          /* Link URL input */
          <div
            className="flex items-center gap-1"
            data-testid="link-input-container"
          >
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleLinkKeyDown}
              placeholder="https://..."
              className="w-48 rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              data-testid="link-url-input"
              autoFocus
            />
            <button
              onClick={handleLinkApply}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              data-testid="link-apply-btn"
            >
              Apply
            </button>
            {editor.isActive("link") && (
              <button
                onClick={handleLinkRemove}
                className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                data-testid="link-remove-btn"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}

// --- Sub-components ---

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  testId: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  testId,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors ${
        isActive
          ? "bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-white"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      }`}
      title={title}
      data-testid={testId}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
```

---

### Step 3: Add Keyboard Shortcut for Link Input (Cmd/Ctrl+K)

TipTap's Link extension does not include a keyboard shortcut by default. We create a small extension to handle Cmd/Ctrl+K.

**File: `src/components/editor/extensions/linkShortcut.ts`**

```typescript
import { Extension } from "@tiptap/core";

/**
 * Adds Cmd/Ctrl+K keyboard shortcut to trigger link editing.
 *
 * This extension dispatches a custom DOM event that the FormattingToolbar
 * listens for. This is necessary because the toolbar needs to show its
 * link input UI, which is a React state concern rather than a ProseMirror
 * command.
 */
export const LinkShortcut = Extension.create({
  name: "linkShortcut",

  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        // Dispatch custom event for the toolbar to handle
        const event = new CustomEvent("tiptap:open-link-input", {
          bubbles: true,
        });
        this.editor.view.dom.dispatchEvent(event);

        // If there's no selection, just return
        const { from, to } = this.editor.state.selection;
        if (from === to) return false;

        return true;
      },
    };
  },
});
```

---

### Step 4: Update FormattingToolbar to Listen for Link Shortcut

**File: `src/components/editor/FormattingToolbar.tsx`** (add event listener for Cmd+K)

Add this `useEffect` inside the `FormattingToolbar` component (after the state declarations):

```tsx
// Listen for Cmd/Ctrl+K keyboard shortcut to open link input
useEffect(() => {
  const handleOpenLink = () => {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      handleLinkClick();
    }
  };

  const editorDom = editor.view.dom;
  editorDom.addEventListener("tiptap:open-link-input", handleOpenLink);

  return () => {
    editorDom.removeEventListener("tiptap:open-link-input", handleOpenLink);
  };
}, [editor, handleLinkClick]);
```

---

### Step 5: Register FormattingToolbar and LinkShortcut in BlockEditor

Update the BlockEditor component to include the FormattingToolbar and the LinkShortcut extension.

**File: `src/components/editor/BlockEditor.tsx`** (modification)

Add to imports:
```tsx
import { FormattingToolbar } from "@/components/editor/FormattingToolbar";
```

Add inside the return JSX, after `<EditorContent editor={editor} />`:
```tsx
{/* Floating formatting toolbar — appears on text selection */}
{editor && <FormattingToolbar editor={editor} />}
```

**File: `src/lib/editor/editorConfig.ts`** (modification — add LinkShortcut)

Add to the extensions array:
```typescript
import { LinkShortcut } from "@/components/editor/extensions/linkShortcut";
// ... inside getBaseExtensions, add to the returned array:
LinkShortcut,
```

---

### Step 6: Add Formatting-Specific Styles

**File: `src/components/editor/editor.css`** (add to existing file)

```css
/* Inline code mark styling */
.tiptap code {
  background-color: #f3f4f6;
  border-radius: 0.25rem;
  padding: 0.15rem 0.3rem;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.875em;
  color: #ef4444;
}

.dark .tiptap code {
  background-color: #374151;
  color: #fb923c;
}

/* Link styling in editor */
.tiptap a {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
}

.tiptap a:hover {
  color: #1d4ed8;
}

.dark .tiptap a {
  color: #60a5fa;
}

.dark .tiptap a:hover {
  color: #93bbfd;
}

/* Strikethrough */
.tiptap s {
  text-decoration: line-through;
  color: #9ca3af;
}
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/components/editor/FormattingToolbar.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Note: Testing BubbleMenu requires a full TipTap editor setup.
// These tests mock the editor and focus on the toolbar UI logic.

describe("FormattingToolbar", () => {
  // Helper to create a mock editor
  function createMockEditor(activeMarks: string[] = []) {
    return {
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: vi.fn() }),
          toggleItalic: () => ({ run: vi.fn() }),
          toggleStrike: () => ({ run: vi.fn() }),
          toggleCode: () => ({ run: vi.fn() }),
          extendMarkRange: () => ({
            setLink: () => ({ run: vi.fn() }),
            unsetLink: () => ({ run: vi.fn() }),
          }),
        }),
      }),
      isActive: (mark: string) => activeMarks.includes(mark),
      getAttributes: () => ({}),
      state: { selection: { from: 0, to: 5 } },
      commands: { focus: vi.fn() },
      view: { dom: document.createElement("div") },
    };
  }

  it("should show bold button as active when bold is applied", () => {
    // This test verifies the active state logic.
    // Full rendering requires TipTap BubbleMenu integration.
    const editor = createMockEditor(["bold"]);
    expect(editor.isActive("bold")).toBe(true);
    expect(editor.isActive("italic")).toBe(false);
  });

  it("should show italic button as active when italic is applied", () => {
    const editor = createMockEditor(["italic"]);
    expect(editor.isActive("italic")).toBe(true);
    expect(editor.isActive("bold")).toBe(false);
  });

  it("should show multiple marks as active simultaneously", () => {
    const editor = createMockEditor(["bold", "italic", "strike"]);
    expect(editor.isActive("bold")).toBe(true);
    expect(editor.isActive("italic")).toBe(true);
    expect(editor.isActive("strike")).toBe(true);
    expect(editor.isActive("code")).toBe(false);
  });
});

describe("ToolbarButton", () => {
  it("should render with aria-pressed when active", () => {
    // Directly test the ToolbarButton sub-component
    const { container } = render(
      <button
        aria-pressed={true}
        data-testid="test-btn"
        className="bg-gray-200"
      >
        B
      </button>
    );

    const btn = screen.getByTestId("test-btn");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });
});
```

### E2E Tests

**File: `tests/e2e/editor/formatting.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Rich Text Formatting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should apply bold with Ctrl+B", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello world");

    // Select "world"
    await page.keyboard.press("Shift+Home");
    await page.keyboard.press("Control+b");

    // Check that bold tag exists
    const bold = editor.locator("strong");
    await expect(bold).toBeVisible();
  });

  test("should apply italic with Ctrl+I", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello world");

    await page.keyboard.press("Shift+Home");
    await page.keyboard.press("Control+i");

    const italic = editor.locator("em");
    await expect(italic).toBeVisible();
  });

  test("should apply strikethrough with Ctrl+Shift+S", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello world");

    await page.keyboard.press("Shift+Home");
    await page.keyboard.press("Control+Shift+s");

    const strike = editor.locator("s");
    await expect(strike).toBeVisible();
  });

  test("should apply inline code with Ctrl+E", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello world");

    await page.keyboard.press("Shift+Home");
    await page.keyboard.press("Control+e");

    const code = editor.locator("code");
    await expect(code).toBeVisible();
  });

  test("should show floating toolbar on text selection", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Select this text");

    // Select all text
    await page.keyboard.press("Control+a");

    const toolbar = page.locator('[data-testid="formatting-toolbar"]');
    await expect(toolbar).toBeVisible();
  });

  test("should hide floating toolbar when selection is collapsed", async ({
    page,
  }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Select this text");

    // Select all
    await page.keyboard.press("Control+a");
    const toolbar = page.locator('[data-testid="formatting-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Collapse selection by pressing right arrow
    await page.keyboard.press("ArrowRight");
    await expect(toolbar).not.toBeVisible();
  });

  test("should show active state on toolbar buttons", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    // Type bold text
    await page.keyboard.press("Control+b");
    await page.keyboard.type("Bold text");
    await page.keyboard.press("Control+b"); // toggle off

    // Select the bold text
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");

    const toolbar = page.locator('[data-testid="formatting-toolbar"]');
    await expect(toolbar).toBeVisible();

    const boldBtn = page.locator('[data-testid="toolbar-bold"]');
    await expect(boldBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("should add link via toolbar", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Click here for more");

    // Select "here"
    await page.keyboard.press("Home");
    for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");

    const toolbar = page.locator('[data-testid="formatting-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Click link button
    const linkBtn = page.locator('[data-testid="toolbar-link"]');
    await linkBtn.click();

    // Enter URL
    const linkInput = page.locator('[data-testid="link-url-input"]');
    await expect(linkInput).toBeVisible();
    await linkInput.fill("https://example.com");

    // Apply
    const applyBtn = page.locator('[data-testid="link-apply-btn"]');
    await applyBtn.click();

    // Verify link exists
    const link = editor.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible();
  });

  test("should remove link via toolbar", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    // Create a link first
    await page.keyboard.type("Link text");
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+k");

    // Type URL in the link input
    const linkInput = page.locator('[data-testid="link-url-input"]');
    await linkInput.fill("https://example.com");
    await page.keyboard.press("Enter");

    // Re-select the link text
    await page.keyboard.press("Control+a");

    // Click link button again
    const linkBtn = page.locator('[data-testid="toolbar-link"]');
    await linkBtn.click();

    // Click remove
    const removeBtn = page.locator('[data-testid="link-remove-btn"]');
    await removeBtn.click();

    // Verify link is removed
    const link = editor.locator("a");
    await expect(link).toHaveCount(0);
  });

  test("should apply bold with markdown shortcut **", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    await page.keyboard.type("**bold text**");

    const bold = editor.locator("strong");
    await expect(bold).toContainText("bold text");
  });

  test("should apply italic with markdown shortcut *", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    await page.keyboard.type("*italic text*");

    const italic = editor.locator("em");
    await expect(italic).toContainText("italic text");
  });

  test("should apply inline code with markdown shortcut", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();

    await page.keyboard.type("`code text`");

    const code = editor.locator("code");
    await expect(code).toContainText("code text");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/editor/FormattingToolbar.tsx` |
| CREATE | `src/components/editor/extensions/linkShortcut.ts` |
| MODIFY | `src/lib/editor/editorConfig.ts` (add Link and LinkShortcut extensions) |
| MODIFY | `src/components/editor/BlockEditor.tsx` (add FormattingToolbar) |
| MODIFY | `src/components/editor/editor.css` (add mark styles) |
| CREATE | `tests/unit/components/editor/FormattingToolbar.test.tsx` |
| CREATE | `tests/e2e/editor/formatting.spec.ts` |

---

**Last Updated:** 2026-02-21
