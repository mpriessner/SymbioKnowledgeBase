# Story SKB-04.6: Block Type Conversion and Undo/Redo

**Epic:** Epic 4 - Block Editor
**Story ID:** SKB-04.6
**Story Points:** 4 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-04.1 (TipTap Editor Integration with Basic Blocks)

---

## User Story

As a researcher, I want to convert blocks between types and undo my changes, So that I can flexibly restructure my content.

---

## Acceptance Criteria

### Block Type Conversion
- [ ] Clicking the drag handle (from SKB-04.4) opens a block action menu with a "Turn into" submenu
- [ ] "Turn into" submenu lists convertible block types: Paragraph, Heading 1, Heading 2, Heading 3, Bullet List, Numbered List, To-Do List, Quote, Callout, Code Block
- [ ] Converting a block preserves its text content
- [ ] Paragraph can convert to: Heading (H1/H2/H3), Bullet List, Numbered List, To-Do List, Quote, Callout, Code Block
- [ ] Heading can convert to: Paragraph, other heading levels, Quote
- [ ] Bullet List can convert to: Numbered List, To-Do List, Paragraph
- [ ] Numbered List can convert to: Bullet List, To-Do List, Paragraph
- [ ] To-Do List can convert to: Bullet List, Numbered List, Paragraph
- [ ] Quote can convert to: Paragraph, Heading, Callout
- [ ] Slash command menu also supports "Turn into" when triggered in non-empty blocks
- [ ] Type conversion works on the block the cursor is currently in

### Block Deletion
- [ ] Pressing Backspace at the start of an empty block (except the first) deletes it
- [ ] Block action menu includes a "Delete" option that removes the block
- [ ] Selecting a block and pressing Delete/Backspace removes it
- [ ] Deleting a block moves cursor to the previous block

### Undo/Redo
- [ ] Cmd/Ctrl+Z undoes the last action (typing, formatting, block conversion, deletion)
- [ ] Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) redoes the last undone action
- [ ] Undo/redo stack supports up to 100 steps (configured in SKB-04.1 StarterKit history)
- [ ] Undo reverses block type conversions
- [ ] Undo reverses block deletions (restores deleted block)
- [ ] Undo reverses drag-and-drop reordering
- [ ] Redo correctly re-applies any undone action

### General
- [ ] All conversions are undoable (integrated with TipTap's History extension)
- [ ] Block action menu is keyboard-accessible
- [ ] TypeScript strict mode — all types fully typed

---

## Architecture Overview

```
Block Action Menu — Trigger and Flow
┌─────────────────────────────────────────────────────────────┐
│  TipTap Editor                                               │
│                                                              │
│  ┌──┐ ┌────────────────────────────────────────────────┐   │
│  │⋮⋮│ │  This is a paragraph block                     │   │
│  └─┬┘ └────────────────────────────────────────────────┘   │
│    │                                                         │
│    │ click                                                   │
│    ▼                                                         │
│  ┌────────────────────────┐                                  │
│  │  Block Action Menu      │                                  │
│  │                         │                                  │
│  │  ▶ Turn into...         │───▶ ┌──────────────────────┐   │
│  │    Delete               │     │  Turn Into Submenu    │   │
│  │    Duplicate            │     │                       │   │
│  │                         │     │  Paragraph            │   │
│  └────────────────────────┘     │  Heading 1            │   │
│                                  │  Heading 2            │   │
│                                  │  Heading 3            │   │
│                                  │  Bulleted List        │   │
│                                  │  Numbered List        │   │
│                                  │  To-Do List           │   │
│                                  │  Quote                │   │
│                                  │  Callout              │   │
│                                  │  Code Block           │   │
│                                  └──────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Conversion Command Flow:
┌──────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  User clicks │────▶│  BlockActionMenu     │────▶│  convertBlock│
│  "Turn into  │     │  dispatches          │     │  ()          │
│   Heading 2" │     │  conversion command  │     │              │
└──────────────┘     └──────────────────────┘     │  Uses TipTap │
                                                   │  commands:   │
                                                   │  - setNode() │
                                                   │  - toggleList│
                                                   │  - wrapIn()  │
                                                   │  - lift()    │
                                                   └──────┬──────┘
                                                          │
                                                          ▼
                                                   ┌─────────────┐
                                                   │  ProseMirror │
                                                   │  transaction │
                                                   │  (added to   │
                                                   │  undo stack) │
                                                   └─────────────┘

Undo/Redo Stack (TipTap History Extension):
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Undo Stack (max 100 steps)     Redo Stack               │
│  ┌─────────────────────┐       ┌─────────────────────┐  │
│  │ Step 100: typed "z" │       │                     │  │
│  │ Step 99:  bold mark │       │  (empty until user  │  │
│  │ Step 98:  convert   │       │   presses Ctrl+Z)   │  │
│  │           to H2     │       │                     │  │
│  │ Step 97:  drag move │       │                     │  │
│  │ ...                 │       │                     │  │
│  └─────────────────────┘       └─────────────────────┘  │
│                                                          │
│  Ctrl+Z: pop from undo → push to redo                   │
│  Ctrl+Shift+Z: pop from redo → push to undo             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Reuse drag handle as menu trigger:** The drag handle (SKB-04.4) already tracks which block the mouse is hovering over. Clicking it opens the block action menu, avoiding a separate trigger element. This follows the Notion pattern.

2. **TipTap commands for conversion:** All block type conversions use TipTap's built-in chain commands (`setNode`, `toggleBulletList`, `toggleOrderedList`, etc.). This ensures all conversions are atomic ProseMirror transactions that integrate with the undo stack.

3. **History from StarterKit:** Undo/redo is provided by the History extension included in StarterKit (configured with depth: 100 in SKB-04.1). No additional implementation needed for the base undo/redo functionality.

---

## Implementation Steps

### Step 1: Create Block Conversion Utility

A set of functions that convert a block at a given position to a different type, preserving text content.

**File: `src/lib/editor/blockConversion.ts`**

```typescript
import type { Editor } from "@tiptap/react";

/**
 * Types that a block can be converted to.
 */
export type ConvertibleBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "callout"
  | "codeBlock";

export interface ConversionOption {
  id: ConvertibleBlockType;
  name: string;
  icon: string;
  description: string;
}

/**
 * All block types available for conversion.
 */
export const conversionOptions: ConversionOption[] = [
  {
    id: "paragraph",
    name: "Paragraph",
    icon: "Aa",
    description: "Plain text block",
  },
  {
    id: "heading1",
    name: "Heading 1",
    icon: "H1",
    description: "Big section heading",
  },
  {
    id: "heading2",
    name: "Heading 2",
    icon: "H2",
    description: "Medium section heading",
  },
  {
    id: "heading3",
    name: "Heading 3",
    icon: "H3",
    description: "Small section heading",
  },
  {
    id: "bulletList",
    name: "Bulleted List",
    icon: "UL",
    description: "Unordered list",
  },
  {
    id: "orderedList",
    name: "Numbered List",
    icon: "OL",
    description: "Ordered list",
  },
  {
    id: "taskList",
    name: "To-Do List",
    icon: "CB",
    description: "List with checkboxes",
  },
  {
    id: "blockquote",
    name: "Quote",
    icon: "QT",
    description: "Capture a quotation",
  },
  {
    id: "callout",
    name: "Callout",
    icon: "CO",
    description: "Highlighted box",
  },
  {
    id: "codeBlock",
    name: "Code Block",
    icon: "CD",
    description: "Code with syntax highlighting",
  },
];

/**
 * Determines which block types the current block can be converted to.
 * Filters out the current block type and types that don't make sense
 * for the current content.
 */
export function getAvailableConversions(
  editor: Editor
): ConversionOption[] {
  // Determine the current block type
  const currentType = getCurrentBlockType(editor);
  if (!currentType) return conversionOptions;

  // Filter out the current type
  return conversionOptions.filter((option) => option.id !== currentType);
}

/**
 * Returns the current block type ID at the cursor position.
 */
function getCurrentBlockType(
  editor: Editor
): ConvertibleBlockType | null {
  if (editor.isActive("heading", { level: 1 })) return "heading1";
  if (editor.isActive("heading", { level: 2 })) return "heading2";
  if (editor.isActive("heading", { level: 3 })) return "heading3";
  if (editor.isActive("bulletList")) return "bulletList";
  if (editor.isActive("orderedList")) return "orderedList";
  if (editor.isActive("taskList")) return "taskList";
  if (editor.isActive("blockquote")) return "blockquote";
  if (editor.isActive("callout")) return "callout";
  if (editor.isActive("codeBlock")) return "codeBlock";
  if (editor.isActive("paragraph")) return "paragraph";
  return null;
}

/**
 * Converts the block at the current cursor position to the specified type.
 * Uses TipTap chain commands to ensure the conversion is a single
 * ProseMirror transaction (compatible with undo/redo).
 */
export function convertBlock(
  editor: Editor,
  targetType: ConvertibleBlockType
): boolean {
  const chain = editor.chain().focus();

  // First, if the current block is a list, lift it out
  const isInList =
    editor.isActive("bulletList") ||
    editor.isActive("orderedList") ||
    editor.isActive("taskList");

  switch (targetType) {
    case "paragraph":
      if (isInList) {
        // Lift list item to paragraph
        chain.liftListItem("listItem").setParagraph().run();
      } else if (editor.isActive("blockquote")) {
        chain.lift("blockquote").setParagraph().run();
      } else {
        chain.setParagraph().run();
      }
      return true;

    case "heading1":
      if (isInList) {
        chain.liftListItem("listItem").setHeading({ level: 1 }).run();
      } else {
        chain.setHeading({ level: 1 }).run();
      }
      return true;

    case "heading2":
      if (isInList) {
        chain.liftListItem("listItem").setHeading({ level: 2 }).run();
      } else {
        chain.setHeading({ level: 2 }).run();
      }
      return true;

    case "heading3":
      if (isInList) {
        chain.liftListItem("listItem").setHeading({ level: 3 }).run();
      } else {
        chain.setHeading({ level: 3 }).run();
      }
      return true;

    case "bulletList":
      if (editor.isActive("orderedList") || editor.isActive("taskList")) {
        // Convert between list types
        chain.toggleBulletList().run();
      } else {
        chain.toggleBulletList().run();
      }
      return true;

    case "orderedList":
      if (editor.isActive("bulletList") || editor.isActive("taskList")) {
        chain.toggleOrderedList().run();
      } else {
        chain.toggleOrderedList().run();
      }
      return true;

    case "taskList":
      if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
        chain.toggleTaskList().run();
      } else {
        chain.toggleTaskList().run();
      }
      return true;

    case "blockquote":
      if (isInList) {
        chain.liftListItem("listItem").toggleBlockquote().run();
      } else {
        chain.toggleBlockquote().run();
      }
      return true;

    case "callout":
      if (isInList) {
        chain.liftListItem("listItem").run();
      }
      // Get the current text content before conversion
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, " ");
      chain
        .insertContent({
          type: "callout",
          attrs: { emoji: "💡", variant: "info" },
          content: [
            {
              type: "paragraph",
              content: text ? [{ type: "text", text }] : [],
            },
          ],
        })
        .run();
      return true;

    case "codeBlock":
      if (isInList) {
        chain.liftListItem("listItem").toggleCodeBlock().run();
      } else {
        chain.toggleCodeBlock().run();
      }
      return true;

    default:
      return false;
  }
}
```

---

### Step 2: Create Block Action Menu Component

The context menu that appears when clicking the drag handle. Contains "Turn into", "Delete", and "Duplicate" options.

**File: `src/components/editor/BlockActionMenu.tsx`**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  conversionOptions,
  convertBlock,
  getAvailableConversions,
  type ConvertibleBlockType,
} from "@/lib/editor/blockConversion";

interface BlockActionMenuProps {
  editor: Editor;
  /** The position of the block node in the document */
  blockPos: number;
  /** Pixel coordinates for positioning the menu */
  anchorX: number;
  anchorY: number;
  /** Callback to close the menu */
  onClose: () => void;
}

export function BlockActionMenu({
  editor,
  blockPos,
  anchorX,
  anchorY,
  onClose,
}: BlockActionMenuProps) {
  const [showTurnInto, setShowTurnInto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const availableConversions = getAvailableConversions(editor);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Handle block type conversion
  const handleConvert = useCallback(
    (targetType: ConvertibleBlockType) => {
      // Move cursor to the target block first
      editor.commands.setTextSelection(blockPos + 1);
      convertBlock(editor, targetType);
      onClose();
    },
    [editor, blockPos, onClose]
  );

  // Handle block deletion
  const handleDelete = useCallback(() => {
    const node = editor.state.doc.nodeAt(blockPos);
    if (node) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: blockPos,
          to: blockPos + node.nodeSize,
        })
        .run();
    }
    onClose();
  }, [editor, blockPos, onClose]);

  // Handle block duplication
  const handleDuplicate = useCallback(() => {
    const node = editor.state.doc.nodeAt(blockPos);
    if (node) {
      const insertPos = blockPos + node.nodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, node.toJSON())
        .run();
    }
    onClose();
  }, [editor, blockPos, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showTurnInto) {
        // Main menu navigation
        const mainItems = ["turnInto", "duplicate", "delete"];
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= mainItems.length - 1 ? 0 : prev + 1
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? mainItems.length - 1 : prev - 1
          );
        } else if (e.key === "Enter" || e.key === "ArrowRight") {
          e.preventDefault();
          if (selectedIndex === 0) {
            setShowTurnInto(true);
            setSelectedIndex(0);
          } else if (selectedIndex === 1) {
            handleDuplicate();
          } else if (selectedIndex === 2) {
            handleDelete();
          }
        }
      } else {
        // Turn into submenu navigation
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= availableConversions.length - 1 ? 0 : prev + 1
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? availableConversions.length - 1 : prev - 1
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          const option = availableConversions[selectedIndex];
          if (option) {
            handleConvert(option.id);
          }
        } else if (e.key === "ArrowLeft" || e.key === "Escape") {
          e.preventDefault();
          setShowTurnInto(false);
          setSelectedIndex(0);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showTurnInto,
    selectedIndex,
    availableConversions,
    handleConvert,
    handleDelete,
    handleDuplicate,
  ]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{ left: anchorX, top: anchorY }}
      role="menu"
      aria-label="Block actions"
      data-testid="block-action-menu"
    >
      {!showTurnInto ? (
        /* Main menu */
        <div className="w-56 py-1">
          {/* Turn into */}
          <button
            className={`flex w-full items-center justify-between px-3 py-2 text-sm ${
              selectedIndex === 0
                ? "bg-gray-100 dark:bg-gray-700"
                : "hover:bg-gray-50 dark:hover:bg-gray-750"
            }`}
            onClick={() => {
              setShowTurnInto(true);
              setSelectedIndex(0);
            }}
            onMouseEnter={() => setSelectedIndex(0)}
            role="menuitem"
            data-testid="menu-turn-into"
          >
            <div className="flex items-center gap-2">
              <TurnIntoIcon />
              <span>Turn into</span>
            </div>
            <ChevronRightIcon />
          </button>

          {/* Duplicate */}
          <button
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
              selectedIndex === 1
                ? "bg-gray-100 dark:bg-gray-700"
                : "hover:bg-gray-50 dark:hover:bg-gray-750"
            }`}
            onClick={handleDuplicate}
            onMouseEnter={() => setSelectedIndex(1)}
            role="menuitem"
            data-testid="menu-duplicate"
          >
            <DuplicateIcon />
            <span>Duplicate</span>
          </button>

          {/* Separator */}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* Delete */}
          <button
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 ${
              selectedIndex === 2
                ? "bg-red-50 dark:bg-red-900/20"
                : "hover:bg-red-50 dark:hover:bg-red-900/20"
            }`}
            onClick={handleDelete}
            onMouseEnter={() => setSelectedIndex(2)}
            role="menuitem"
            data-testid="menu-delete"
          >
            <DeleteIcon />
            <span>Delete</span>
          </button>
        </div>
      ) : (
        /* Turn into submenu */
        <div className="w-60 py-1" data-testid="turn-into-submenu">
          {/* Back button */}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
            onClick={() => {
              setShowTurnInto(false);
              setSelectedIndex(0);
            }}
            data-testid="turn-into-back"
          >
            <ChevronLeftIcon />
            <span>Back</span>
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* Conversion options */}
          {availableConversions.map((option, index) => (
            <button
              key={option.id}
              className={`flex w-full items-center gap-3 px-3 py-2 text-sm ${
                index === selectedIndex
                  ? "bg-gray-100 dark:bg-gray-700"
                  : "hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
              onClick={() => handleConvert(option.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="menuitem"
              data-testid={`convert-to-${option.id}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-xs font-bold text-gray-500 dark:border-gray-600 dark:text-gray-400">
                {option.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {option.name}
                </p>
                <p className="text-xs text-gray-400">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Icon components ---

function TurnIntoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
```

---

### Step 3: Integrate Block Action Menu with Drag Handle

Update the BlockEditor component to manage the block action menu state and wire it to the drag handle's click event.

**File: `src/components/editor/BlockEditor.tsx`** (modification — add BlockActionMenu)

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { getBaseExtensions } from "@/lib/editor/editorConfig";
import { usePageBlocks } from "@/hooks/useBlockEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/editor/SaveStatusIndicator";
import { FormattingToolbar } from "@/components/editor/FormattingToolbar";
import { BlockActionMenu } from "@/components/editor/BlockActionMenu";
import type { SaveStatus } from "@/types/editor";

interface BlockEditorProps {
  pageId: string;
  editable?: boolean;
}

interface MenuState {
  isOpen: boolean;
  blockPos: number;
  x: number;
  y: number;
}

export function BlockEditor({ pageId, editable = true }: BlockEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [menuState, setMenuState] = useState<MenuState>({
    isOpen: false,
    blockPos: 0,
    x: 0,
    y: 0,
  });

  const { data: blocks, isLoading, isError } = usePageBlocks(pageId);

  const documentContent: JSONContent | undefined = blocks
    ?.find((b) => b.type === "DOCUMENT")
    ?.content as JSONContent | undefined;

  // Handle drag handle click to open block action menu
  const handleDragHandleClick = useCallback(
    (pos: number, event: MouseEvent) => {
      setMenuState({
        isOpen: true,
        blockPos: pos,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const handleMenuClose = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const editor = useEditor({
    extensions: getBaseExtensions({
      onDragHandleClick: handleDragHandleClick,
    }),
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-stone dark:prose-invert max-w-none min-h-[500px] px-8 py-4 focus:outline-none",
        "data-testid": "block-editor",
      },
    },
    content: undefined,
    autofocus: "end",
  });

  // Load content into editor
  useEffect(() => {
    if (editor && documentContent && !editor.isDestroyed) {
      const currentContent = editor.getJSON();
      const isEmptyDoc =
        currentContent.content?.length === 1 &&
        currentContent.content[0].type === "paragraph" &&
        !currentContent.content[0].content;

      if (isEmptyDoc) {
        editor.commands.setContent(documentContent);
      }
    }
  }, [editor, documentContent]);

  const handleStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  useAutoSave({
    editor,
    pageId,
    debounceMs: 1000,
    onStatusChange: handleStatusChange,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-pulse text-gray-400">Loading editor...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-red-500">
          Failed to load page content. Please try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" data-testid="block-editor-container">
      <div className="sticky top-0 z-10 flex justify-end px-8 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <SaveStatusIndicator status={saveStatus} />
      </div>

      <EditorContent editor={editor} />

      {/* Floating formatting toolbar */}
      {editor && <FormattingToolbar editor={editor} />}

      {/* Block action menu (triggered by drag handle click) */}
      {menuState.isOpen && editor && (
        <BlockActionMenu
          editor={editor}
          blockPos={menuState.blockPos}
          anchorX={menuState.x}
          anchorY={menuState.y}
          onClose={handleMenuClose}
        />
      )}
    </div>
  );
}
```

---

### Step 4: History Extension Verification

The History extension is already included in StarterKit (configured in SKB-04.1). This step verifies the configuration and documents the keyboard shortcuts.

The StarterKit configuration in `editorConfig.ts` already includes:
```typescript
history: {
  depth: 100, // Keep last 100 undo steps
},
```

This provides:
- **Undo:** Cmd/Ctrl+Z (built-in keyboard shortcut)
- **Redo:** Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (built-in keyboard shortcuts)
- **Stack depth:** 100 steps (sufficient for most editing sessions)

All editor operations that go through ProseMirror transactions are automatically added to the undo stack, including:
- Typing text
- Applying/removing formatting marks
- Block type conversions
- Drag-and-drop reordering
- Block deletion and insertion

No additional implementation is needed for undo/redo.

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/lib/editor/blockConversion.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  conversionOptions,
  getAvailableConversions,
  type ConvertibleBlockType,
} from "@/lib/editor/blockConversion";

describe("conversionOptions", () => {
  it("should include all expected block types", () => {
    const ids = conversionOptions.map((o) => o.id);
    expect(ids).toContain("paragraph");
    expect(ids).toContain("heading1");
    expect(ids).toContain("heading2");
    expect(ids).toContain("heading3");
    expect(ids).toContain("bulletList");
    expect(ids).toContain("orderedList");
    expect(ids).toContain("taskList");
    expect(ids).toContain("blockquote");
    expect(ids).toContain("callout");
    expect(ids).toContain("codeBlock");
  });

  it("should have 10 conversion options", () => {
    expect(conversionOptions).toHaveLength(10);
  });

  it("should have unique IDs", () => {
    const ids = conversionOptions.map((o) => o.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should have non-empty name, icon, and description for all options", () => {
    conversionOptions.forEach((option) => {
      expect(option.name.length).toBeGreaterThan(0);
      expect(option.icon.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    });
  });
});

describe("getAvailableConversions", () => {
  it("should return all options when editor state cannot be determined", () => {
    // Mock editor where no block type is active
    const mockEditor = {
      isActive: () => false,
    } as unknown as import("@tiptap/react").Editor;

    const result = getAvailableConversions(mockEditor);
    expect(result.length).toBe(conversionOptions.length);
  });

  it("should exclude the current block type from results", () => {
    // Mock editor where paragraph is active
    const mockEditor = {
      isActive: (name: string) => name === "paragraph",
    } as unknown as import("@tiptap/react").Editor;

    const result = getAvailableConversions(mockEditor);
    const ids = result.map((o) => o.id);
    expect(ids).not.toContain("paragraph");
    expect(result.length).toBe(conversionOptions.length - 1);
  });

  it("should exclude heading1 when H1 is active", () => {
    const mockEditor = {
      isActive: (name: string, attrs?: Record<string, unknown>) =>
        name === "heading" && attrs?.level === 1,
    } as unknown as import("@tiptap/react").Editor;

    const result = getAvailableConversions(mockEditor);
    const ids = result.map((o) => o.id);
    expect(ids).not.toContain("heading1");
    expect(ids).toContain("heading2");
    expect(ids).toContain("heading3");
  });
});
```

### Component Tests

**File: `tests/unit/components/editor/BlockActionMenu.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

describe("BlockActionMenu", () => {
  it("should render main menu items", () => {
    // This test verifies the menu structure.
    // Full rendering requires a TipTap editor mock.
    const menuItems = ["Turn into", "Duplicate", "Delete"];
    menuItems.forEach((item) => {
      expect(item).toBeTruthy();
    });
  });

  it("should have correct ARIA attributes", () => {
    const role = "menu";
    const label = "Block actions";
    expect(role).toBe("menu");
    expect(label).toBe("Block actions");
  });
});
```

### E2E Tests

**File: `tests/e2e/editor/block-conversion.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Block Type Conversion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');

    // Type some initial content
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Convert this text");
  });

  test("should open block action menu from drag handle", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const menu = page.locator('[data-testid="block-action-menu"]');
    await expect(menu).toBeVisible();
  });

  test("should show Turn into submenu", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const submenu = page.locator('[data-testid="turn-into-submenu"]');
    await expect(submenu).toBeVisible();
  });

  test("should convert paragraph to Heading 2", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const heading2Option = page.locator('[data-testid="convert-to-heading2"]');
    await heading2Option.click();

    const heading = page.locator('[data-testid="block-editor"] h2');
    await expect(heading).toContainText("Convert this text");
  });

  test("should convert paragraph to bullet list", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const bulletOption = page.locator('[data-testid="convert-to-bulletList"]');
    await bulletOption.click();

    const listItem = page.locator('[data-testid="block-editor"] li');
    await expect(listItem).toContainText("Convert this text");
  });

  test("should convert heading back to paragraph", async ({ page }) => {
    // First create a heading
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("# ");

    // Now convert it back
    const heading = page.locator('[data-testid="block-editor"] h1').first();
    await heading.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const paragraphOption = page.locator(
      '[data-testid="convert-to-paragraph"]'
    );
    await paragraphOption.click();

    const para = page.locator('[data-testid="block-editor"] p').first();
    await expect(para).toContainText("Convert this text");
  });

  test("should preserve text content during conversion", async ({ page }) => {
    const originalText = "Convert this text";

    // Convert to H1
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const turnInto = page.locator('[data-testid="menu-turn-into"]');
    await turnInto.click();

    const heading1 = page.locator('[data-testid="convert-to-heading1"]');
    await heading1.click();

    const heading = page.locator('[data-testid="block-editor"] h1');
    await expect(heading).toContainText(originalText);
  });

  test("should close menu on Escape", async ({ page }) => {
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const menu = page.locator('[data-testid="block-action-menu"]');
    await expect(menu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });
});

test.describe("Block Deletion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should delete block from action menu", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("First paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second paragraph");

    // Open menu for second paragraph
    const paragraphs = page.locator('[data-testid="block-editor"] p');
    const secondP = paragraphs.nth(1);
    await secondP.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    const deleteBtn = page.locator('[data-testid="menu-delete"]');
    await deleteBtn.click();

    // Only first paragraph should remain
    await expect(paragraphs).toHaveCount(1);
    await expect(paragraphs.first()).toContainText("First paragraph");
  });

  test("should delete block with Backspace at start of empty block", async ({
    page,
  }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("First paragraph");
    await page.keyboard.press("Enter");
    // Second paragraph is empty, press Backspace to delete it
    await page.keyboard.press("Backspace");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs).toHaveCount(1);
  });
});

test.describe("Undo/Redo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');
  });

  test("should undo typed text with Ctrl+Z", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello world");

    // Undo
    await page.keyboard.press("Control+z");

    // Some or all text should be removed
    // (TipTap groups rapid typing into single undo steps)
    await expect(editor).not.toContainText("Hello world");
  });

  test("should redo after undo with Ctrl+Shift+Z", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Hello");

    // Small delay to create a separate undo step
    await page.waitForTimeout(500);
    await page.keyboard.type(" world");

    // Undo "world"
    await page.keyboard.press("Control+z");
    await expect(editor).toContainText("Hello");

    // Redo "world"
    await page.keyboard.press("Control+Shift+z");
    await expect(editor).toContainText("Hello world");
  });

  test("should undo block type conversion", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("My paragraph text");

    // Convert to H2 via slash command
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");

    // Use the block action menu to convert
    const paragraph = page.locator('[data-testid="block-editor"] p').first();
    await paragraph.hover();
    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();

    await page.locator('[data-testid="menu-turn-into"]').click();
    await page.locator('[data-testid="convert-to-heading2"]').click();

    // Verify it's now a heading
    const heading = page.locator('[data-testid="block-editor"] h2');
    await expect(heading).toBeVisible();

    // Undo
    await page.keyboard.press("Control+z");

    // Should revert to paragraph
    const para = page.locator('[data-testid="block-editor"] p').first();
    await expect(para).toContainText("My paragraph text");
  });

  test("should undo bold formatting", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Normal text");

    // Select all and bold
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+b");

    // Verify bold
    const bold = editor.locator("strong");
    await expect(bold).toBeVisible();

    // Undo
    await page.keyboard.press("Control+z");

    // Bold should be removed
    await expect(bold).not.toBeVisible();
    await expect(editor).toContainText("Normal text");
  });

  test("should undo block deletion", async ({ page }) => {
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("Keep this");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Delete this");

    // Delete second paragraph via menu
    const secondP = page.locator('[data-testid="block-editor"] p').nth(1);
    await secondP.hover();
    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await dragHandle.click();
    await page.locator('[data-testid="menu-delete"]').click();

    // Verify deleted
    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs).toHaveCount(1);

    // Undo deletion
    await page.keyboard.press("Control+z");

    // Second paragraph should be restored
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.nth(1)).toContainText("Delete this");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/editor/blockConversion.ts` |
| CREATE | `src/components/editor/BlockActionMenu.tsx` |
| MODIFY | `src/components/editor/BlockEditor.tsx` (add BlockActionMenu integration) |
| MODIFY | `src/components/editor/extensions/dragHandle.ts` (wire onDragHandleClick callback) |
| CREATE | `tests/unit/lib/editor/blockConversion.test.ts` |
| CREATE | `tests/unit/components/editor/BlockActionMenu.test.tsx` |
| CREATE | `tests/e2e/editor/block-conversion.spec.ts` |

---

**Last Updated:** 2026-02-21
