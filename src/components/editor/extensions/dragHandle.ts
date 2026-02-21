import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
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
