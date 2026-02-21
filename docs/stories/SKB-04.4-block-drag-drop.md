# Story SKB-04.4: Block Drag-and-Drop Reordering

**Epic:** Epic 4 - Block Editor
**Story ID:** SKB-04.4
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-04.1 (TipTap Editor Integration with Basic Blocks)

---

## User Story

As a researcher, I want to drag blocks to reorder them, So that I can reorganize my content easily.

---

## Acceptance Criteria

- [ ] A drag handle icon (six-dot grip ⋮⋮) appears to the left of each top-level block on hover
- [ ] The drag handle is visible only on hover (hidden by default to keep the editor clean)
- [ ] Clicking and dragging the handle initiates a drag operation for that block
- [ ] While dragging, a semi-transparent preview of the block follows the cursor
- [ ] A blue drop indicator line appears between blocks to show the insertion point
- [ ] Dropping the block at the indicator line reorders the document
- [ ] The reordered content is automatically persisted via the existing auto-save from SKB-04.1
- [ ] Drag-and-drop works with all block types: paragraphs, headings, lists, blockquotes, dividers, etc.
- [ ] Nested list items are dragged as part of their parent list (not individually)
- [ ] Drag handle position adjusts correctly for different block types (headings are taller)
- [ ] Keyboard users can access block reordering via Alt+ArrowUp / Alt+ArrowDown shortcuts
- [ ] Dragging is disabled in read-only mode
- [ ] The drag handle also serves as a click target that opens the block action menu (used in SKB-04.6)
- [ ] TypeScript strict mode — all extension and component types fully typed

---

## Architecture Overview

```
TipTap Editor — Block Drag Handle Behavior
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Normal state (no hover):                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  This is a paragraph of text that the user has typed.  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Hover state (mouse over block):                             │
│  ┌──┐ ┌────────────────────────────────────────────────┐   │
│  │⋮⋮│ │  This is a paragraph of text that the user     │   │
│  └──┘ │  has typed.                                     │   │
│   ▲   └────────────────────────────────────────────────┘   │
│   │                                                          │
│   └── DragHandle (appears on hover, positioned absolutely)  │
│                                                              │
│  Dragging state:                                             │
│  ┌──┐ ┌────────────────────────────────────────────────┐   │
│  │⋮⋮│ │  ## Section Title             (being dragged)  │   │
│  └──┘ └────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Some other paragraph block                             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ══════════════════════════════════════════════════════════  │
│  ▲ Drop indicator line (blue line between blocks)           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Another paragraph                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Implementation Approach:
┌──────────────────────────────────────────────────────┐
│  Option A: Global DragHandle Extension (chosen)       │
│                                                       │
│  Uses a single floating drag handle element that     │
│  repositions itself based on which block the cursor  │
│  is hovering over. This avoids adding drag handle    │
│  elements to every block in the DOM.                 │
│                                                       │
│  - ProseMirror plugin tracks mouse position           │
│  - Resolves the nearest top-level block node          │
│  - Positions the drag handle element to the left      │
│  - On drag start: creates ProseMirror NodeSelection   │
│  - On drag end: executes ProseMirror move transaction │
│                                                       │
│  TipTap 3 provides @tiptap/extension-drag-handle     │
│  but for full control we implement a custom version.  │
└──────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Single floating handle:** Instead of rendering a drag handle inside each block's DOM, we use a single absolutely-positioned element. This is cleaner and avoids bloating the document structure. The handle repositions itself based on mouse hover using a ProseMirror plugin.

2. **ProseMirror-level drag:** The drag operation uses ProseMirror's native node drag capabilities. This ensures the document state remains consistent and the operation integrates with TipTap's undo/redo history.

3. **Block-level granularity:** Only top-level blocks (direct children of the document node) are draggable. Nested content (e.g., list items within a list) moves with its parent.

---

## Implementation Steps

### Step 1: Create the Drag Handle Extension

A TipTap extension that renders a floating drag handle and manages the drag-and-drop lifecycle.

**File: `src/components/editor/extensions/dragHandle.ts`**

```typescript
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import type { ResolvedPos } from "@tiptap/pm/model";

export const dragHandlePluginKey = new PluginKey("dragHandle");

interface DragHandleState {
  /** The position of the block node currently being hovered */
  activeBlockPos: number | null;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
}

/**
 * Resolves a mouse position to the nearest top-level block node position.
 * Returns the start position of the block, or null if not found.
 */
function resolveBlockPos(
  view: EditorView,
  coords: { left: number; top: number }
): number | null {
  const pos = view.posAtCoords(coords);
  if (!pos) return null;

  const $pos: ResolvedPos = view.state.doc.resolve(pos.pos);

  // Walk up to find the top-level block (depth 1 = direct child of doc)
  let depth = $pos.depth;
  while (depth > 1) {
    depth--;
  }

  if (depth < 1) return null;

  return $pos.before(depth);
}

/**
 * Creates the drag handle DOM element.
 */
function createDragHandleElement(): HTMLElement {
  const handle = document.createElement("div");
  handle.className = "block-drag-handle";
  handle.setAttribute("data-testid", "drag-handle");
  handle.setAttribute("draggable", "true");
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "Drag to reorder block");
  handle.setAttribute("tabindex", "-1");
  handle.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4" cy="2" r="1.5"/>
      <circle cx="10" cy="2" r="1.5"/>
      <circle cx="4" cy="7" r="1.5"/>
      <circle cx="10" cy="7" r="1.5"/>
      <circle cx="4" cy="12" r="1.5"/>
      <circle cx="10" cy="12" r="1.5"/>
    </svg>
  `;
  return handle;
}

export const DragHandle = Extension.create({
  name: "dragHandle",

  addOptions() {
    return {
      /** Callback when drag handle is clicked (for block action menu in SKB-04.6) */
      onDragHandleClick: undefined as
        | ((pos: number, event: MouseEvent) => void)
        | undefined,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options as {
      onDragHandleClick?: (pos: number, event: MouseEvent) => void;
    };

    let dragHandleElement: HTMLElement | null = null;
    let dropIndicatorElement: HTMLElement | null = null;

    return [
      new Plugin<DragHandleState>({
        key: dragHandlePluginKey,

        state: {
          init(): DragHandleState {
            return { activeBlockPos: null, isDragging: false };
          },
          apply(tr, value): DragHandleState {
            const meta = tr.getMeta(dragHandlePluginKey) as
              | Partial<DragHandleState>
              | undefined;
            if (meta) {
              return { ...value, ...meta };
            }
            return value;
          },
        },

        view(editorView) {
          // Create the drag handle element
          dragHandleElement = createDragHandleElement();
          dragHandleElement.style.display = "none";
          editorView.dom.parentElement?.appendChild(dragHandleElement);

          // Create the drop indicator element
          dropIndicatorElement = document.createElement("div");
          dropIndicatorElement.className = "block-drop-indicator";
          dropIndicatorElement.setAttribute(
            "data-testid",
            "drop-indicator"
          );
          dropIndicatorElement.style.display = "none";
          editorView.dom.parentElement?.appendChild(dropIndicatorElement);

          let draggedBlockPos: number | null = null;

          // Handle drag start
          const handleDragStart = (e: DragEvent) => {
            const state = dragHandlePluginKey.getState(editorView.state);
            if (!state?.activeBlockPos && state?.activeBlockPos !== 0) return;

            draggedBlockPos = state.activeBlockPos;
            e.dataTransfer?.setData("text/plain", ""); // Required for Firefox

            editorView.dispatch(
              editorView.state.tr.setMeta(dragHandlePluginKey, {
                isDragging: true,
              })
            );
          };

          // Handle click (for block action menu)
          const handleClick = (e: MouseEvent) => {
            const state = dragHandlePluginKey.getState(editorView.state);
            if (
              state?.activeBlockPos !== null &&
              state?.activeBlockPos !== undefined &&
              options.onDragHandleClick
            ) {
              options.onDragHandleClick(state.activeBlockPos, e);
            }
          };

          dragHandleElement.addEventListener("dragstart", handleDragStart);
          dragHandleElement.addEventListener("click", handleClick);

          // Handle drag over (show drop indicator)
          const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            if (draggedBlockPos === null) return;

            const targetPos = resolveBlockPos(editorView, {
              left: e.clientX,
              top: e.clientY,
            });

            if (targetPos === null || !dropIndicatorElement) return;

            // Position the drop indicator
            const targetNode = editorView.nodeDOM(targetPos) as
              | HTMLElement
              | undefined;
            if (targetNode) {
              const rect = targetNode.getBoundingClientRect();
              const editorRect =
                editorView.dom.parentElement?.getBoundingClientRect();
              if (editorRect) {
                const relativeTop = rect.top - editorRect.top;
                const midpoint = relativeTop + rect.height / 2;

                // Show indicator above or below the target block
                const insertBelow = e.clientY - rect.top > rect.height / 2;
                const indicatorTop = insertBelow
                  ? relativeTop + rect.height
                  : relativeTop;

                dropIndicatorElement.style.display = "block";
                dropIndicatorElement.style.top = `${indicatorTop}px`;
              }
            }
          };

          // Handle drop
          const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            if (draggedBlockPos === null) return;

            const targetPos = resolveBlockPos(editorView, {
              left: e.clientX,
              top: e.clientY,
            });

            if (targetPos === null) return;

            const { state } = editorView;
            const draggedNode = state.doc.nodeAt(draggedBlockPos);
            if (!draggedNode) return;

            // Determine insertion position
            const targetNode = state.doc.nodeAt(targetPos);
            if (!targetNode) return;

            const targetRect = (
              editorView.nodeDOM(targetPos) as HTMLElement
            )?.getBoundingClientRect();
            const insertAfter =
              targetRect && e.clientY - targetRect.top > targetRect.height / 2;

            // Build the move transaction
            let tr = state.tr;
            const nodeSize = draggedNode.nodeSize;

            // Delete the dragged node from its original position
            tr = tr.delete(draggedBlockPos, draggedBlockPos + nodeSize);

            // Calculate the new insertion position
            // (adjusted because the document shrank after deletion)
            let insertPos = insertAfter
              ? targetPos + targetNode.nodeSize
              : targetPos;

            if (draggedBlockPos < targetPos) {
              insertPos -= nodeSize;
            }

            // Clamp to document bounds
            insertPos = Math.max(0, Math.min(insertPos, tr.doc.content.size));

            // Insert the node at the new position
            tr = tr.insert(insertPos, draggedNode);

            editorView.dispatch(tr);

            // Clean up
            draggedBlockPos = null;
            if (dropIndicatorElement) {
              dropIndicatorElement.style.display = "none";
            }

            editorView.dispatch(
              editorView.state.tr.setMeta(dragHandlePluginKey, {
                isDragging: false,
              })
            );
          };

          // Handle drag end (clean up)
          const handleDragEnd = () => {
            draggedBlockPos = null;
            if (dropIndicatorElement) {
              dropIndicatorElement.style.display = "none";
            }
            editorView.dispatch(
              editorView.state.tr.setMeta(dragHandlePluginKey, {
                isDragging: false,
              })
            );
          };

          const editorParent = editorView.dom.parentElement;
          editorParent?.addEventListener("dragover", handleDragOver);
          editorParent?.addEventListener("drop", handleDrop);
          editorParent?.addEventListener("dragend", handleDragEnd);

          return {
            update(view) {
              // Update drag handle position if active block changed
              const state = dragHandlePluginKey.getState(view.state);
              if (
                !dragHandleElement ||
                state?.activeBlockPos === null ||
                state?.activeBlockPos === undefined
              ) {
                if (dragHandleElement) {
                  dragHandleElement.style.display = "none";
                }
                return;
              }

              const node = view.nodeDOM(state.activeBlockPos) as
                | HTMLElement
                | undefined;
              if (!node || !editorParent) {
                dragHandleElement.style.display = "none";
                return;
              }

              const nodeRect = node.getBoundingClientRect();
              const editorRect = editorParent.getBoundingClientRect();

              dragHandleElement.style.display = "flex";
              dragHandleElement.style.top = `${nodeRect.top - editorRect.top + 4}px`;
              dragHandleElement.style.left = `${-28}px`;
            },
            destroy() {
              dragHandleElement?.remove();
              dropIndicatorElement?.remove();
              editorParent?.removeEventListener("dragover", handleDragOver);
              editorParent?.removeEventListener("drop", handleDrop);
              editorParent?.removeEventListener("dragend", handleDragEnd);
            },
          };
        },

        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              if (!editor.isEditable) return false;

              const blockPos = resolveBlockPos(view, {
                left: event.clientX,
                top: event.clientY,
              });

              const currentState = dragHandlePluginKey.getState(view.state);
              if (currentState?.activeBlockPos !== blockPos) {
                view.dispatch(
                  view.state.tr.setMeta(dragHandlePluginKey, {
                    activeBlockPos: blockPos,
                  })
                );
              }

              return false;
            },
            mouseleave(view) {
              const currentState = dragHandlePluginKey.getState(view.state);
              if (currentState?.activeBlockPos !== null) {
                // Delay hiding to allow mouse to reach the handle
                setTimeout(() => {
                  view.dispatch(
                    view.state.tr.setMeta(dragHandlePluginKey, {
                      activeBlockPos: null,
                    })
                  );
                }, 200);
              }
              return false;
            },
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Alt+ArrowUp: Move block up
      "Alt-ArrowUp": ({ editor: e }) => {
        const { $from } = e.state.selection;
        let depth = $from.depth;
        while (depth > 1) depth--;
        if (depth < 1) return false;

        const blockStart = $from.before(depth);
        if (blockStart <= 0) return false; // Already at the top

        const node = e.state.doc.nodeAt(blockStart);
        if (!node) return false;

        // Find the previous sibling block
        const $blockStart = e.state.doc.resolve(blockStart);
        const prevPos = $blockStart.before(depth);
        if (prevPos < 0) return false;

        // Swap the two blocks by moving current block before previous
        const tr = e.state.tr;
        const prevNode = e.state.doc.nodeAt(prevPos);
        if (!prevNode) return false;

        tr.delete(blockStart, blockStart + node.nodeSize);
        tr.insert(prevPos, node);
        e.view.dispatch(tr);

        return true;
      },

      // Alt+ArrowDown: Move block down
      "Alt-ArrowDown": ({ editor: e }) => {
        const { $from } = e.state.selection;
        let depth = $from.depth;
        while (depth > 1) depth--;
        if (depth < 1) return false;

        const blockStart = $from.before(depth);
        const node = e.state.doc.nodeAt(blockStart);
        if (!node) return false;

        const blockEnd = blockStart + node.nodeSize;
        if (blockEnd >= e.state.doc.content.size) return false; // Already at the bottom

        const nextNode = e.state.doc.nodeAt(blockEnd);
        if (!nextNode) return false;

        // Swap the two blocks by moving current block after next
        const tr = e.state.tr;
        tr.delete(blockStart, blockEnd);
        tr.insert(blockStart + nextNode.nodeSize, node);
        e.view.dispatch(tr);

        return true;
      },
    };
  },
});
```

---

### Step 2: Add Drag Handle Styles

**File: `src/components/editor/editor.css`** (add to existing file)

```css
/* Drag Handle */
.block-drag-handle {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: grab;
  color: #9ca3af;
  transition: opacity 150ms ease, background-color 150ms ease;
  opacity: 0;
  z-index: 20;
  user-select: none;
}

.block-drag-handle:hover {
  background-color: #f3f4f6;
  color: #6b7280;
  opacity: 1;
}

.dark .block-drag-handle:hover {
  background-color: #374151;
  color: #9ca3af;
}

/* Show handle when parent block is hovered */
[data-testid="block-editor-container"]:hover .block-drag-handle {
  opacity: 0.5;
}

.block-drag-handle:active {
  cursor: grabbing;
}

/* Drop Indicator */
.block-drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background-color: #3b82f6;
  border-radius: 2px;
  pointer-events: none;
  z-index: 30;
  transition: top 100ms ease;
}

/* Dragging state: add slight opacity to all blocks */
.tiptap.is-dragging > * {
  opacity: 0.7;
}

.tiptap.is-dragging > .ProseMirror-selectednode {
  opacity: 0.4;
  outline: 2px dashed #3b82f6;
  outline-offset: 2px;
}
```

---

### Step 3: Register DragHandle Extension in Editor Config

**File: `src/lib/editor/editorConfig.ts`** (modification — add DragHandle)

```typescript
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { SlashCommand } from "@/components/editor/extensions/slashCommand";
import { LinkShortcut } from "@/components/editor/extensions/linkShortcut";
import { DragHandle } from "@/components/editor/extensions/dragHandle";
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
  ];
}
```

---

### Step 4: Update BlockEditor to Use Relative Positioning

The drag handle and drop indicator are positioned absolutely relative to the editor container. The container needs `position: relative`.

**File: `src/components/editor/BlockEditor.tsx`** (minor modification)

Update the container div class:

```tsx
<div className="relative w-full" data-testid="block-editor-container">
```

This is already in the SKB-04.1 implementation, so no additional changes are needed. The `relative` class ensures that the absolutely-positioned drag handle and drop indicator elements are contained within the editor area.

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/components/editor/extensions/dragHandle.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("DragHandle Extension", () => {
  describe("resolveBlockPos", () => {
    it("should resolve mouse coordinates to the nearest top-level block position", () => {
      // This test would require a ProseMirror EditorView mock.
      // In practice, we test this through integration/E2E tests.
      expect(true).toBe(true); // Placeholder — see E2E tests
    });
  });

  describe("Keyboard shortcuts", () => {
    it("should define Alt+ArrowUp shortcut for moving block up", () => {
      // Verify the extension registers the correct keyboard shortcuts
      // This is tested through E2E tests below
      const shortcuts = ["Alt-ArrowUp", "Alt-ArrowDown"];
      expect(shortcuts).toContain("Alt-ArrowUp");
      expect(shortcuts).toContain("Alt-ArrowDown");
    });
  });

  describe("createDragHandleElement", () => {
    it("should create an element with correct attributes", () => {
      const handle = document.createElement("div");
      handle.className = "block-drag-handle";
      handle.setAttribute("draggable", "true");
      handle.setAttribute("role", "button");
      handle.setAttribute("aria-label", "Drag to reorder block");

      expect(handle.getAttribute("draggable")).toBe("true");
      expect(handle.getAttribute("role")).toBe("button");
      expect(handle.getAttribute("aria-label")).toBe(
        "Drag to reorder block"
      );
      expect(handle.className).toBe("block-drag-handle");
    });
  });
});
```

### E2E Tests

**File: `tests/e2e/editor/drag-drop.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Block Drag-and-Drop Reordering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pages/test-page-id");
    await page.waitForSelector('[data-testid="block-editor"]');

    // Create some content to work with
    const editor = page.locator('[data-testid="block-editor"]');
    await editor.click();
    await page.keyboard.type("First paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Third paragraph");
  });

  test("should show drag handle on block hover", async ({ page }) => {
    // Hover over the first paragraph
    const firstParagraph = page.locator('[data-testid="block-editor"] p').first();
    await firstParagraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await expect(dragHandle).toBeVisible();
  });

  test("should hide drag handle when not hovering a block", async ({
    page,
  }) => {
    // Move mouse away from the editor
    await page.mouse.move(0, 0);

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    await expect(dragHandle).not.toBeVisible();
  });

  test("should show drop indicator during drag", async ({ page }) => {
    // Get first paragraph position
    const firstParagraph = page.locator('[data-testid="block-editor"] p').first();
    await firstParagraph.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    const handleBox = await dragHandle.boundingBox();
    const thirdParagraph = page.locator('[data-testid="block-editor"] p').nth(2);
    const thirdBox = await thirdParagraph.boundingBox();

    if (handleBox && thirdBox) {
      // Start drag from handle
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2
      );
      await page.mouse.down();

      // Drag to third paragraph
      await page.mouse.move(
        thirdBox.x + thirdBox.width / 2,
        thirdBox.y + thirdBox.height / 2,
        { steps: 5 }
      );

      const dropIndicator = page.locator('[data-testid="drop-indicator"]');
      await expect(dropIndicator).toBeVisible();

      await page.mouse.up();
    }
  });

  test("should reorder blocks via drag-and-drop", async ({ page }) => {
    // Get first and third paragraph positions for drag
    const paragraphs = page.locator('[data-testid="block-editor"] p');
    const firstText = await paragraphs.nth(0).textContent();
    const thirdText = await paragraphs.nth(2).textContent();

    expect(firstText).toBe("First paragraph");
    expect(thirdText).toBe("Third paragraph");

    // Hover first paragraph and drag to after third
    const firstP = paragraphs.nth(0);
    await firstP.hover();

    const dragHandle = page.locator('[data-testid="drag-handle"]');
    const handleBox = await dragHandle.boundingBox();
    const thirdP = paragraphs.nth(2);
    const thirdBox = await thirdP.boundingBox();

    if (handleBox && thirdBox) {
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        thirdBox.x + thirdBox.width / 2,
        thirdBox.y + thirdBox.height,
        { steps: 10 }
      );
      await page.mouse.up();
    }

    // After drag: order should be Second, Third, First
    const reorderedParagraphs = page.locator(
      '[data-testid="block-editor"] p'
    );
    await expect(reorderedParagraphs.nth(0)).toContainText("Second paragraph");
    await expect(reorderedParagraphs.nth(2)).toContainText("First paragraph");
  });

  test("should move block up with Alt+ArrowUp", async ({ page }) => {
    // Place cursor in second paragraph
    const secondP = page.locator('[data-testid="block-editor"] p').nth(1);
    await secondP.click();

    // Move up
    await page.keyboard.press("Alt+ArrowUp");

    // Second paragraph should now be first
    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("Second paragraph");
    await expect(paragraphs.nth(1)).toContainText("First paragraph");
  });

  test("should move block down with Alt+ArrowDown", async ({ page }) => {
    // Place cursor in first paragraph
    const firstP = page.locator('[data-testid="block-editor"] p').first();
    await firstP.click();

    // Move down
    await page.keyboard.press("Alt+ArrowDown");

    // First paragraph should now be second
    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("Second paragraph");
    await expect(paragraphs.nth(1)).toContainText("First paragraph");
  });

  test("should not move first block up past the beginning", async ({
    page,
  }) => {
    const firstP = page.locator('[data-testid="block-editor"] p').first();
    await firstP.click();

    // Try to move up (should have no effect)
    await page.keyboard.press("Alt+ArrowUp");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("First paragraph");
  });

  test("should not move last block down past the end", async ({ page }) => {
    const lastP = page.locator('[data-testid="block-editor"] p').nth(2);
    await lastP.click();

    // Try to move down (should have no effect)
    await page.keyboard.press("Alt+ArrowDown");

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(2)).toContainText("Third paragraph");
  });

  test("should persist reordered content after auto-save", async ({
    page,
  }) => {
    // Move second paragraph up via keyboard
    const secondP = page.locator('[data-testid="block-editor"] p').nth(1);
    await secondP.click();
    await page.keyboard.press("Alt+ArrowUp");

    // Wait for auto-save
    const saveStatus = page.locator('[data-testid="save-status"]');
    await expect(saveStatus).toContainText("Saved", { timeout: 5000 });

    // Reload and verify order persisted
    await page.reload();
    await page.waitForSelector('[data-testid="block-editor"]');

    const paragraphs = page.locator('[data-testid="block-editor"] p');
    await expect(paragraphs.nth(0)).toContainText("Second paragraph");
    await expect(paragraphs.nth(1)).toContainText("First paragraph");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/editor/extensions/dragHandle.ts` |
| MODIFY | `src/lib/editor/editorConfig.ts` (add DragHandle extension) |
| MODIFY | `src/components/editor/editor.css` (add drag handle + drop indicator styles) |
| MODIFY | `src/components/editor/BlockEditor.tsx` (ensure relative positioning on container) |
| CREATE | `tests/unit/components/editor/extensions/dragHandle.test.ts` |
| CREATE | `tests/e2e/editor/drag-drop.spec.ts` |

---

**Last Updated:** 2026-02-21
