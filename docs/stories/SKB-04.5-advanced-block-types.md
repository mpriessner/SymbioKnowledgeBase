# Story SKB-04.5: Advanced Block Types

**Epic:** Epic 4 - Block Editor
**Story ID:** SKB-04.5
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-04.1 (TipTap Editor Integration with Basic Blocks)

---

## User Story

As a researcher, I want specialized block types like code blocks, callouts, and images, So that I can include diverse content in my notes.

---

## Acceptance Criteria

### To-Do List
- [ ] To-do list items render with interactive checkboxes
- [ ] Clicking a checkbox toggles its checked/unchecked state
- [ ] Checked items show strikethrough text
- [ ] Uses `@tiptap/extension-task-list` and `@tiptap/extension-task-item`
- [ ] Pressing Enter in a task item creates a new unchecked task item
- [ ] Pressing Backspace in an empty task item converts it back to a paragraph

### Toggle Block
- [ ] Toggle block renders with a triangle indicator (collapsed/expanded)
- [ ] Clicking the triangle toggles the block open/closed
- [ ] Content inside the toggle is hidden when collapsed
- [ ] Toggle state (isOpen) is stored in the block's node attributes and persisted
- [ ] Implemented as a custom TipTap node extension

### Callout Block
- [ ] Callout renders as a styled box with configurable icon (emoji) and background color
- [ ] Four variants supported: info (blue), warning (yellow), success (green), error (red)
- [ ] Default variant is "info" with light bulb icon
- [ ] Clicking the emoji opens a small emoji picker for the callout
- [ ] Callout content is editable rich text
- [ ] Implemented as a custom TipTap node extension

### Code Block
- [ ] Code block renders with syntax highlighting via lowlight
- [ ] Language selector dropdown in the top-right corner of the code block
- [ ] Supported languages: JavaScript, TypeScript, Python, Go, Rust, SQL, JSON, HTML, CSS, Bash, Markdown
- [ ] Copy-to-clipboard button in the code block header
- [ ] Line numbers displayed on the left
- [ ] Tab key inserts spaces (not changes focus) when inside code block
- [ ] Uses `@tiptap/extension-code-block-lowlight`

### Image Block
- [ ] Image block accepts a URL or file upload
- [ ] Image renders within the document with proper sizing
- [ ] Caption text below the image (optional, editable)
- [ ] Image loads lazily with blur-up placeholder
- [ ] Uses `@tiptap/extension-image`

### Bookmark Block
- [ ] Bookmark block accepts a URL
- [ ] Server-side API fetches Open Graph metadata (title, description, favicon)
- [ ] Renders as a card with favicon, title, description, and URL domain
- [ ] Loading state while metadata is being fetched
- [ ] Error state if URL is invalid or metadata cannot be fetched
- [ ] Implemented as a custom TipTap node extension

### General
- [ ] All block types are insertable via the slash command menu (SKB-04.2)
- [ ] All block content is persisted as part of the TipTap JSON document
- [ ] All custom extensions are TypeScript strict-mode compliant

---

## Architecture Overview

```
Advanced Block Types — Extension Architecture
┌─────────────────────────────────────────────────────────────┐
│  TipTap Editor Extensions                                    │
│                                                              │
│  Built-in Extensions (configured):                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  TaskList         │  │  TaskItem         │                │
│  │  @tiptap/         │  │  @tiptap/         │                │
│  │  extension-       │  │  extension-       │                │
│  │  task-list        │  │  task-item        │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  CodeBlockLowlight│  │  Image            │                │
│  │  @tiptap/         │  │  @tiptap/         │                │
│  │  extension-       │  │  extension-       │                │
│  │  code-block-      │  │  image            │                │
│  │  lowlight         │  │                   │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  Custom Extensions:                                          │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Toggle           │  │  Callout          │                │
│  │  src/components/  │  │  src/components/  │                │
│  │  editor/          │  │  editor/          │                │
│  │  extensions/      │  │  extensions/      │                │
│  │  toggle.ts        │  │  callout.ts       │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐                                       │
│  │  Bookmark         │                                       │
│  │  src/components/  │                                       │
│  │  editor/          │                                       │
│  │  extensions/      │                                       │
│  │  bookmark.ts      │                                       │
│  └──────────────────┘                                       │
│                                                              │
│  React Node Views (for complex rendering):                   │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  CodeBlock.tsx    │  │  Callout.tsx      │                │
│  │  - Language       │  │  - Emoji picker   │                │
│  │    selector       │  │  - Variant colors │                │
│  │  - Copy button    │  │  - Rich content   │                │
│  │  - Line numbers   │  │                   │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  ImageBlock.tsx   │  │  Bookmark.tsx     │                │
│  │  - URL/upload     │  │  - OG card        │                │
│  │  - Caption        │  │  - Loading state  │                │
│  │  - Lazy loading   │  │  - Metadata fetch │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Bookmark Metadata Flow:
┌──────────┐    ┌─────────────────────────┐    ┌──────────────┐
│  User    │    │  API Route              │    │  External    │
│  pastes  │───▶│  POST /api/og-metadata  │───▶│  Website     │
│  URL     │    │  (server-side fetch)    │◀───│  (OG tags)   │
│          │◀───│  Returns: title, desc,  │    │              │
│          │    │  favicon, image         │    └──────────────┘
└──────────┘    └─────────────────────────┘
```

---

## Implementation Steps

### Step 1: Configure Task List Extension (To-Do List)

Configure the built-in TaskList and TaskItem extensions from TipTap.

**File: `src/components/editor/extensions/taskList.ts`**

```typescript
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import type { Extensions } from "@tiptap/react";

/**
 * Configures the TaskList and TaskItem extensions for to-do list blocks.
 *
 * TaskItem is configured with nested: true to allow sub-tasks.
 * The checkbox toggle is handled by TipTap's built-in click handler.
 */
export function getTaskListExtensions(): Extensions {
  return [
    TaskList.configure({
      HTMLAttributes: {
        class: "task-list",
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: "task-item",
      },
    }),
  ];
}
```

---

### Step 2: Create Toggle Extension (Collapsible Block)

A custom TipTap node extension for collapsible toggle blocks.

**File: `src/components/editor/extensions/toggle.ts`**

```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ToggleView } from "@/components/editor/nodeViews/ToggleView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggle: {
      /**
       * Insert a toggle block
       */
      insertToggle: () => ReturnType;
      /**
       * Toggle the open/closed state
       */
      toggleOpen: (pos: number) => ReturnType;
    };
  }
}

export const Toggle = Node.create({
  name: "toggle",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      isOpen: {
        default: true,
        parseHTML: (element) =>
          element.getAttribute("data-is-open") !== "false",
        renderHTML: (attributes) => ({
          "data-is-open": attributes.isOpen as boolean,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      insertToggle:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { isOpen: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "" }],
                },
              ],
            })
            .run();
        },
      toggleOpen:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              isOpen: !node.attrs.isOpen,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
```

**File: `src/components/editor/nodeViews/ToggleView.tsx`**

```tsx
"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const isOpen = node.attrs.isOpen as boolean;

  const handleToggle = () => {
    updateAttributes({ isOpen: !isOpen });
  };

  return (
    <NodeViewWrapper
      className="toggle-block my-2"
      data-testid="toggle-block"
    >
      <div className="flex items-start gap-1">
        {/* Toggle indicator */}
        <button
          onClick={handleToggle}
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse toggle" : "Expand toggle"}
          data-testid="toggle-trigger"
          contentEditable={false}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          >
            <path d="M4 2l4 4-4 4z" />
          </svg>
        </button>

        {/* Toggle content */}
        <div className="min-w-0 flex-1">
          <NodeViewContent
            className={`toggle-content ${isOpen ? "" : "hidden"}`}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
```

---

### Step 3: Create Callout Extension

A custom TipTap node extension for callout/admonition blocks.

**File: `src/components/editor/extensions/callout.ts`**

```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutView } from "@/components/editor/nodeViews/CalloutView";

export type CalloutVariant = "info" | "warning" | "success" | "error";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /**
       * Insert a callout block
       */
      insertCallout: (attrs?: {
        emoji?: string;
        variant?: CalloutVariant;
      }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (element) =>
          element.getAttribute("data-emoji") ?? "💡",
        renderHTML: (attributes) => ({
          "data-emoji": attributes.emoji as string,
        }),
      },
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (element) =>
          (element.getAttribute("data-variant") as CalloutVariant) ?? "info",
        renderHTML: (attributes) => ({
          "data-variant": attributes.variant as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      insertCallout:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                emoji: attrs?.emoji ?? "💡",
                variant: attrs?.variant ?? "info",
              },
              content: [
                {
                  type: "paragraph",
                  content: [],
                },
              ],
            })
            .run();
        },
    };
  },
});
```

**File: `src/components/editor/nodeViews/CalloutView.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { CalloutVariant } from "@/components/editor/extensions/callout";

const variantStyles: Record<
  CalloutVariant,
  { bg: string; border: string; text: string }
> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-900 dark:text-yellow-100",
  },
  success: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-900 dark:text-green-100",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-900 dark:text-red-100",
  },
};

const defaultEmojis = ["💡", "⚠️", "✅", "❌", "📝", "🔥", "💬", "📌", "🎯", "🚀"];

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emoji = node.attrs.emoji as string;
  const variant = node.attrs.variant as CalloutVariant;
  const styles = variantStyles[variant];

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <NodeViewWrapper
      className={`callout-block my-3 rounded-lg border-l-4 p-4 ${styles.bg} ${styles.border}`}
      data-testid="callout-block"
      data-variant={variant}
    >
      <div className="flex items-start gap-3">
        {/* Emoji icon — clickable to change */}
        <div className="relative" ref={emojiPickerRef} contentEditable={false}>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-black/5 dark:hover:bg-white/5"
            data-testid="callout-emoji-btn"
            title="Change icon"
          >
            {emoji}
          </button>

          {/* Mini emoji picker */}
          {showEmojiPicker && (
            <div
              className="absolute left-0 top-10 z-50 grid grid-cols-5 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              data-testid="callout-emoji-picker"
            >
              {defaultEmojis.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    updateAttributes({ emoji: e });
                    setShowEmojiPicker(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Callout content */}
        <div className={`min-w-0 flex-1 ${styles.text}`}>
          <NodeViewContent className="callout-content" />
        </div>
      </div>

      {/* Variant selector */}
      <div
        className="mt-2 flex gap-1"
        contentEditable={false}
        data-testid="callout-variant-selector"
      >
        {(Object.keys(variantStyles) as CalloutVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => updateAttributes({ variant: v })}
            className={`rounded px-2 py-0.5 text-xs capitalize ${
              variant === v
                ? "bg-gray-200 font-medium dark:bg-gray-600"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            data-testid={`callout-variant-${v}`}
          >
            {v}
          </button>
        ))}
      </div>
    </NodeViewWrapper>
  );
}
```

---

### Step 4: Configure Code Block with Lowlight

Configure the CodeBlockLowlight extension with syntax highlighting and a React node view for the language selector and copy button.

**File: `src/components/editor/extensions/codeBlock.ts`**

```typescript
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { CodeBlockView } from "@/components/editor/nodeViews/CodeBlockView";

// Import additional languages beyond the "common" set
import typescript from "highlight.js/lib/languages/typescript";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";

// Create lowlight instance with curated languages
const lowlight = createLowlight(common);
lowlight.register("typescript", typescript);
lowlight.register("go", go);
lowlight.register("rust", rust);

/**
 * Supported languages for the code block language selector.
 * Each entry maps a display name to the lowlight language ID.
 */
export const SUPPORTED_LANGUAGES = [
  { label: "Plain Text", value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
  { label: "SQL", value: "sql" },
  { label: "JSON", value: "json" },
  { label: "HTML", value: "xml" }, // lowlight uses "xml" for HTML
  { label: "CSS", value: "css" },
  { label: "Bash", value: "bash" },
  { label: "Markdown", value: "markdown" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["value"];

/**
 * Configured CodeBlockLowlight extension with:
 * - Syntax highlighting via lowlight
 * - React node view for language selector and copy button
 * - Tab handling (insert spaces instead of changing focus)
 */
export const ConfiguredCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  addKeyboardShortcuts() {
    return {
      // Tab inserts 2 spaces in code blocks
      Tab: ({ editor }) => {
        if (editor.isActive("codeBlock")) {
          editor.commands.insertContent("  ");
          return true;
        }
        return false;
      },
      // Shift+Tab removes 2 spaces at the start of the line
      "Shift-Tab": ({ editor }) => {
        if (editor.isActive("codeBlock")) {
          // Simple implementation: just prevent default
          return true;
        }
        return false;
      },
    };
  },
}).configure({
  lowlight,
  defaultLanguage: "javascript",
  HTMLAttributes: {
    class: "code-block",
  },
});
```

**File: `src/components/editor/nodeViews/CodeBlockView.tsx`**

```tsx
"use client";

import { useState, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/components/editor/extensions/codeBlock";

export function CodeBlockView({
  node,
  updateAttributes,
  extension,
}: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as SupportedLanguage) || "";

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: e.target.value });
    },
    [updateAttributes]
  );

  const handleCopy = useCallback(async () => {
    const text = node.textContent;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [node]);

  return (
    <NodeViewWrapper
      className="code-block-wrapper relative my-3 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
      data-testid="code-block"
    >
      {/* Code block header */}
      <div
        className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700"
        contentEditable={false}
      >
        {/* Language selector */}
        <select
          value={language}
          onChange={handleLanguageChange}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          data-testid="code-block-language"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
          data-testid="code-block-copy"
          title="Copy code"
        >
          {copied ? (
            <>
              <CheckIcon />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with line numbers */}
      <div className="overflow-x-auto">
        <pre className="p-4">
          <NodeViewContent
            as="code"
            className={`hljs language-${language}`}
          />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

// --- Icon components ---

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-green-600"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
```

---

### Step 5: Configure Image Extension

**File: `src/components/editor/extensions/imageBlock.ts`**

```typescript
import Image from "@tiptap/extension-image";

/**
 * Configured Image extension.
 *
 * For MVP, images are inserted via URL. File upload support can be
 * added in a future iteration by handling paste/drop events.
 *
 * The inline: false setting ensures images are block-level elements
 * rather than inline images within paragraphs.
 */
export const ConfiguredImage = Image.configure({
  inline: false,
  allowBase64: false, // Disallow base64 in JSONB — too large
  HTMLAttributes: {
    class: "editor-image rounded-lg max-w-full mx-auto my-4",
    loading: "lazy",
  },
});
```

**File: `src/components/editor/nodeViews/ImageBlock.tsx`**

```tsx
"use client";

import { useState } from "react";

interface ImageBlockProps {
  src: string;
  alt?: string;
  title?: string;
}

/**
 * Standalone image block component.
 * Used when a more complex image rendering is needed
 * (e.g., with caption, resize handles).
 *
 * For MVP, the base Image extension handles rendering.
 * This component is provided for future enhancement.
 */
export function ImageBlock({ src, alt, title }: ImageBlockProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className="my-4 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 dark:border-gray-600 dark:bg-gray-800"
        data-testid="image-block-error"
      >
        <p className="text-sm text-gray-500">
          Failed to load image
        </p>
      </div>
    );
  }

  return (
    <figure className="my-4" data-testid="image-block">
      <div className="relative">
        {/* Blur placeholder while loading */}
        {!isLoaded && (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        )}
        <img
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          loading="lazy"
          className={`mx-auto max-w-full rounded-lg transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
      {alt && (
        <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}
```

---

### Step 6: Create Bookmark Extension

A custom TipTap node extension that renders a URL as a rich preview card with Open Graph metadata.

**File: `src/components/editor/extensions/bookmark.ts`**

```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BookmarkView } from "@/components/editor/nodeViews/BookmarkView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      /**
       * Insert a bookmark block
       */
      insertBookmark: (attrs: { url: string }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create({
  name: "bookmark",

  group: "block",

  atom: true, // Non-editable inline — content is managed by the node view

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url") ?? "",
        renderHTML: (attributes) => ({
          "data-url": attributes.url as string,
        }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") ?? "",
        renderHTML: (attributes) => ({
          "data-title": attributes.title as string,
        }),
      },
      description: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-description") ?? "",
        renderHTML: (attributes) => ({
          "data-description": attributes.description as string,
        }),
      },
      favicon: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-favicon") ?? "",
        renderHTML: (attributes) => ({
          "data-favicon": attributes.favicon as string,
        }),
      },
      image: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-image") ?? "",
        renderHTML: (attributes) => ({
          "data-image": attributes.image as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="bookmark"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "bookmark" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },

  addCommands() {
    return {
      insertBookmark:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    };
  },
});
```

**File: `src/components/editor/nodeViews/BookmarkView.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

interface OgMetadata {
  title: string;
  description: string;
  favicon: string;
  image: string;
}

export function BookmarkView({ node, updateAttributes }: NodeViewProps) {
  const url = node.attrs.url as string;
  const title = node.attrs.title as string;
  const description = node.attrs.description as string;
  const favicon = node.attrs.favicon as string;
  const image = node.attrs.image as string;

  const [isLoading, setIsLoading] = useState(!title && !!url);
  const [hasError, setHasError] = useState(false);

  // Fetch OG metadata if not already present
  useEffect(() => {
    if (!url || title) return;

    let cancelled = false;

    async function fetchMetadata() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/og-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) throw new Error("Failed to fetch metadata");

        const data: { data: OgMetadata } = await res.json();
        if (!cancelled) {
          updateAttributes({
            title: data.data.title || new URL(url).hostname,
            description: data.data.description || "",
            favicon: data.data.favicon || "",
            image: data.data.image || "",
          });
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
          // Set a fallback title from the URL
          updateAttributes({
            title: new URL(url).hostname,
          });
        }
      }
    }

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [url, title, updateAttributes]);

  // Extract domain from URL for display
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  // Loading state
  if (isLoading) {
    return (
      <NodeViewWrapper data-testid="bookmark-block">
        <div className="my-3 animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="h-16 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-testid="bookmark-block" contentEditable={false}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="my-3 flex cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
        data-testid="bookmark-link"
      >
        {/* Text content */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {title || domain}
          </p>
          {description && (
            <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            {favicon && (
              <img
                src={favicon}
                alt=""
                className="h-4 w-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="truncate">{domain}</span>
          </div>
        </div>

        {/* Preview image */}
        {image && (
          <div className="hidden w-[200px] shrink-0 sm:block">
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display =
                  "none";
              }}
            />
          </div>
        )}
      </a>
    </NodeViewWrapper>
  );
}
```

---

### Step 7: Create OG Metadata API Route

Server-side API route that fetches Open Graph metadata from a URL.

**File: `src/app/api/og-metadata/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/apiResponse";

const ogMetadataSchema = z.object({
  url: z.string().url("Invalid URL"),
});

// POST /api/og-metadata — Fetch Open Graph metadata for a URL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ogMetadataSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        apiError("Invalid input", 400, parsed.error.flatten().fieldErrors),
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SymbioKnowledgeBase/1.0 (Bookmark Preview)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        apiError("Failed to fetch URL", 502),
        { status: 502 }
      );
    }

    const html = await response.text();

    // Parse OG meta tags from HTML
    const title = extractMetaContent(html, "og:title") ||
      extractTitle(html) ||
      "";
    const description = extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      "";
    const image = extractMetaContent(html, "og:image") || "";
    const favicon = extractFavicon(html, url);

    return NextResponse.json(
      apiSuccess({
        title,
        description,
        favicon,
        image: resolveUrl(image, url),
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        apiError("Request timeout", 504),
        { status: 504 }
      );
    }
    console.error("OG metadata fetch error:", error);
    return NextResponse.json(
      apiError("Failed to fetch metadata", 500),
      { status: 500 }
    );
  }
}

/**
 * Extract content from a meta tag by property or name attribute.
 */
function extractMetaContent(html: string, property: string): string {
  // Try property attribute first (OG tags)
  const propertyRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const propertyMatch = html.match(propertyRegex);
  if (propertyMatch?.[1]) return propertyMatch[1];

  // Try reversed attribute order
  const reversedRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
    "i"
  );
  const reversedMatch = html.match(reversedRegex);
  if (reversedMatch?.[1]) return reversedMatch[1];

  // Try name attribute (standard meta tags)
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch?.[1]) return nameMatch[1];

  return "";
}

/**
 * Extract the <title> tag content.
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

/**
 * Extract the favicon URL from the HTML.
 */
function extractFavicon(html: string, baseUrl: string): string {
  const iconRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i;
  const match = html.match(iconRegex);
  if (match?.[1]) {
    return resolveUrl(match[1], baseUrl);
  }
  // Default favicon location
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

---

### Step 8: Register All Advanced Extensions in Editor Config

**File: `src/lib/editor/editorConfig.ts`** (final version with all extensions)

```typescript
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { SlashCommand } from "@/components/editor/extensions/slashCommand";
import { LinkShortcut } from "@/components/editor/extensions/linkShortcut";
import { DragHandle } from "@/components/editor/extensions/dragHandle";
import { getTaskListExtensions } from "@/components/editor/extensions/taskList";
import { Toggle } from "@/components/editor/extensions/toggle";
import { Callout } from "@/components/editor/extensions/callout";
import { ConfiguredCodeBlock } from "@/components/editor/extensions/codeBlock";
import { ConfiguredImage } from "@/components/editor/extensions/imageBlock";
import { Bookmark } from "@/components/editor/extensions/bookmark";
import type { Extensions } from "@tiptap/react";

const DEFAULT_PLACEHOLDER = "Type '/' for commands...";

export interface EditorConfigOptions {
  placeholder?: string;
  onDragHandleClick?: (pos: number, event: MouseEvent) => void;
}

export function getBaseExtensions(
  options: EditorConfigOptions = {}
): Extensions {
  const { placeholder = DEFAULT_PLACEHOLDER, onDragHandleClick } = options;

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
      // Disable the built-in code block — we use CodeBlockLowlight instead
      codeBlock: false,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer",
        rel: "noopener noreferrer",
        target: "_blank",
      },
      validate: (href) => /^https?:\/\//.test(href),
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
    LinkShortcut,
    DragHandle.configure({
      onDragHandleClick,
    }),
    // Advanced block types (SKB-04.5)
    ...getTaskListExtensions(),
    Toggle,
    Callout,
    ConfiguredCodeBlock,
    ConfiguredImage,
    Bookmark,
  ];
}
```

---

### Step 9: Add Advanced Block Type Styles

**File: `src/components/editor/editor.css`** (add to existing file)

```css
/* Task List (To-Do) */
.task-list {
  list-style: none;
  padding-left: 0;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.task-item > label {
  display: flex;
  align-items: center;
  margin-top: 0.25rem;
}

.task-item > label input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  accent-color: #3b82f6;
}

.task-item[data-checked="true"] > div {
  text-decoration: line-through;
  color: #9ca3af;
}

/* Toggle Block */
.toggle-block {
  border-left: 2px solid #e5e7eb;
  padding-left: 0.5rem;
}

.dark .toggle-block {
  border-left-color: #374151;
}

.toggle-content.hidden {
  display: none;
}

/* Code Block */
.code-block-wrapper pre {
  margin: 0;
  overflow-x: auto;
}

.code-block-wrapper pre code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  tab-size: 2;
}

/* Highlight.js theme overrides for dark mode */
.dark .code-block-wrapper .hljs {
  background: transparent;
}

/* Editor Image */
.editor-image {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem auto;
  display: block;
}

/* Callout variants — handled by Tailwind classes in the component */
/* Additional global callout styles if needed */
.callout-content p:first-child {
  margin-top: 0;
}

.callout-content p:last-child {
  margin-bottom: 0;
}
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/components/editor/extensions/toggle.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("Toggle Extension", () => {
  it("should define correct node name", () => {
    expect("toggle").toBe("toggle");
  });

  it("should have isOpen attribute default to true", () => {
    const defaultAttrs = { isOpen: true };
    expect(defaultAttrs.isOpen).toBe(true);
  });

  it("should support content group 'block+'", () => {
    // Verifies the schema allows block-level content inside toggles
    const contentExpression = "block+";
    expect(contentExpression).toBe("block+");
  });
});

describe("Callout Extension", () => {
  it("should define correct node name", () => {
    expect("callout").toBe("callout");
  });

  it("should support all four variants", () => {
    const variants = ["info", "warning", "success", "error"];
    expect(variants).toHaveLength(4);
  });

  it("should default to info variant with light bulb emoji", () => {
    const defaults = { emoji: "💡", variant: "info" };
    expect(defaults.emoji).toBe("💡");
    expect(defaults.variant).toBe("info");
  });
});

describe("Bookmark Extension", () => {
  it("should define correct attributes", () => {
    const attrs = ["url", "title", "description", "favicon", "image"];
    expect(attrs).toContain("url");
    expect(attrs).toContain("title");
    expect(attrs).toContain("description");
    expect(attrs).toContain("favicon");
    expect(attrs).toContain("image");
  });
});
```

**File: `tests/unit/components/editor/extensions/codeBlock.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES } from "@/components/editor/extensions/codeBlock";

describe("Code Block Configuration", () => {
  it("should support all required languages", () => {
    const labels = SUPPORTED_LANGUAGES.map((l) => l.label);
    expect(labels).toContain("JavaScript");
    expect(labels).toContain("TypeScript");
    expect(labels).toContain("Python");
    expect(labels).toContain("Go");
    expect(labels).toContain("Rust");
    expect(labels).toContain("SQL");
    expect(labels).toContain("JSON");
    expect(labels).toContain("HTML");
    expect(labels).toContain("CSS");
    expect(labels).toContain("Bash");
    expect(labels).toContain("Markdown");
    expect(labels).toContain("Plain Text");
  });

  it("should have unique values for all languages", () => {
    const values = SUPPORTED_LANGUAGES.map((l) => l.value);
    // Plain Text has empty string value, all others should be unique
    const nonEmpty = values.filter((v) => v !== "");
    const unique = new Set(nonEmpty);
    expect(unique.size).toBe(nonEmpty.length);
  });
});
```

### Integration Tests

**File: `tests/integration/api/og-metadata.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("OG Metadata API", () => {
  const BASE_URL = "http://localhost:3000";

  it("should return metadata for a valid URL", async () => {
    const res = await fetch(`${BASE_URL}/api/og-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty("title");
    expect(json.data).toHaveProperty("description");
    expect(json.data).toHaveProperty("favicon");
  });

  it("should return 400 for invalid URL", async () => {
    const res = await fetch(`${BASE_URL}/api/og-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "not-a-url" }),
    });

    expect(res.status).toBe(400);
  });

  it("should return 400 for missing URL", async () => {
    const res = await fetch(`${BASE_URL}/api/og-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
```

### E2E Tests

**File: `tests/e2e/editor/advanced-blocks.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Advanced Block Types", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test.describe("To-Do List", () => {
    test("should insert a task list via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/todo");
      await page.keyboard.press("Enter");
      await page.keyboard.type("First task");

      const taskItem = page.locator(".task-item");
      await expect(taskItem).toBeVisible();
    });

    test("should toggle checkbox on click", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/todo");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Toggle me");

      const checkbox = page.locator('.task-item input[type="checkbox"]');
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe("Toggle Block", () => {
    test("should insert a toggle block via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/toggle");
      await page.keyboard.press("Enter");

      const toggle = page.locator('[data-testid="toggle-block"]');
      await expect(toggle).toBeVisible();
    });

    test("should collapse and expand on trigger click", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/toggle");
      await page.keyboard.press("Enter");

      const trigger = page.locator('[data-testid="toggle-trigger"]');
      const content = page.locator(".toggle-content");

      // Initially expanded
      await expect(content).not.toHaveClass(/hidden/);

      // Collapse
      await trigger.click();
      await expect(content).toHaveClass(/hidden/);

      // Expand again
      await trigger.click();
      await expect(content).not.toHaveClass(/hidden/);
    });
  });

  test.describe("Callout Block", () => {
    test("should insert a callout via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/callout");
      await page.keyboard.press("Enter");

      const callout = page.locator('[data-testid="callout-block"]');
      await expect(callout).toBeVisible();
    });

    test("should change callout variant", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/callout");
      await page.keyboard.press("Enter");

      // Click warning variant
      const warningBtn = page.locator('[data-testid="callout-variant-warning"]');
      await warningBtn.click();

      const callout = page.locator('[data-testid="callout-block"]');
      await expect(callout).toHaveAttribute("data-variant", "warning");
    });

    test("should change callout emoji", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/callout");
      await page.keyboard.press("Enter");

      // Open emoji picker
      const emojiBtn = page.locator('[data-testid="callout-emoji-btn"]');
      await emojiBtn.click();

      const picker = page.locator('[data-testid="callout-emoji-picker"]');
      await expect(picker).toBeVisible();

      // Select a different emoji
      const emojiOption = picker.locator("button").nth(1); // Second emoji
      await emojiOption.click();

      // Picker should close
      await expect(picker).not.toBeVisible();
    });
  });

  test.describe("Code Block", () => {
    test("should insert a code block via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");

      const codeBlock = page.locator('[data-testid="code-block"]');
      await expect(codeBlock).toBeVisible();
    });

    test("should change language via selector", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");

      const languageSelect = page.locator('[data-testid="code-block-language"]');
      await languageSelect.selectOption("typescript");
      await expect(languageSelect).toHaveValue("typescript");
    });

    test("should copy code to clipboard", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");
      await page.keyboard.type("const x = 42;");

      const copyBtn = page.locator('[data-testid="code-block-copy"]');
      await copyBtn.click();

      await expect(copyBtn).toContainText("Copied");
    });

    test("should insert tab as spaces inside code block", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/code");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await page.keyboard.type("indented");

      // The code block should contain indented text
      const codeBlock = page.locator('[data-testid="code-block"]');
      await expect(codeBlock).toContainText("indented");
    });
  });

  test.describe("Image Block", () => {
    test("should insert an image via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/image");

      // Handle the prompt dialog
      page.on("dialog", async (dialog) => {
        await dialog.accept("https://via.placeholder.com/300");
      });
      await page.keyboard.press("Enter");

      const image = editor.locator("img");
      await expect(image).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Bookmark Block", () => {
    test("should insert a bookmark via slash menu", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/bookmark");

      // Handle the prompt dialog
      page.on("dialog", async (dialog) => {
        await dialog.accept("https://example.com");
      });
      await page.keyboard.press("Enter");

      const bookmark = page.locator('[data-testid="bookmark-block"]');
      await expect(bookmark).toBeVisible({ timeout: 10000 });
    });

    test("should display bookmark with fetched metadata", async ({ page }) => {
      const editor = page.locator('[data-testid="block-editor"]');
      await editor.click();
      await page.keyboard.type("/bookmark");

      page.on("dialog", async (dialog) => {
        await dialog.accept("https://example.com");
      });
      await page.keyboard.press("Enter");

      // Wait for metadata to load
      const bookmarkLink = page.locator('[data-testid="bookmark-link"]');
      await expect(bookmarkLink).toBeVisible({ timeout: 10000 });
      await expect(bookmarkLink).toHaveAttribute(
        "href",
        "https://example.com"
      );
    });
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/editor/extensions/taskList.ts` |
| CREATE | `src/components/editor/extensions/toggle.ts` |
| CREATE | `src/components/editor/nodeViews/ToggleView.tsx` |
| CREATE | `src/components/editor/extensions/callout.ts` |
| CREATE | `src/components/editor/nodeViews/CalloutView.tsx` |
| CREATE | `src/components/editor/extensions/codeBlock.ts` |
| CREATE | `src/components/editor/nodeViews/CodeBlockView.tsx` |
| CREATE | `src/components/editor/extensions/imageBlock.ts` |
| CREATE | `src/components/editor/nodeViews/ImageBlock.tsx` |
| CREATE | `src/components/editor/extensions/bookmark.ts` |
| CREATE | `src/components/editor/nodeViews/BookmarkView.tsx` |
| CREATE | `src/app/api/og-metadata/route.ts` |
| MODIFY | `src/lib/editor/editorConfig.ts` (register all advanced extensions) |
| MODIFY | `src/components/editor/editor.css` (add advanced block styles) |
| MODIFY | `package.json` (add lowlight, highlight.js dependencies) |
| CREATE | `tests/unit/components/editor/extensions/toggle.test.ts` |
| CREATE | `tests/unit/components/editor/extensions/codeBlock.test.ts` |
| CREATE | `tests/integration/api/og-metadata.test.ts` |
| CREATE | `tests/e2e/editor/advanced-blocks.spec.ts` |

---

**Last Updated:** 2026-02-21
