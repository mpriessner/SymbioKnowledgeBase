import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { SlashCommand } from "@/components/editor/extensions/slashCommand";
import { LinkShortcut } from "@/components/editor/extensions/linkShortcut";
import { DragHandle } from "@/components/editor/extensions/dragHandle";
import { WikilinkExtension } from "@/components/editor/extensions/WikilinkExtension";
import { createWikilinkSuggestion } from "@/components/editor/extensions/wikilinkSuggestionPlugin";
import type { Extensions } from "@tiptap/react";

// Default placeholder text for empty editor
const DEFAULT_PLACEHOLDER = "Type '/' for commands...";

export interface EditorConfigOptions {
  placeholder?: string;
  onDragHandleClick?: (pos: number, event: MouseEvent) => void;
}

/**
 * Returns the base TipTap extensions for the block editor.
 *
 * StarterKit includes:
 * - Document, Paragraph, Text (core)
 * - Heading (H1-H3 configured)
 * - BulletList, OrderedList, ListItem
 * - Blockquote, CodeBlock, HorizontalRule
 * - HardBreak, History (undo/redo)
 * - Bold, Italic, Strike, Code (marks)
 */
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
      undoRedo: {
        depth: 100,
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-[var(--accent-primary)] underline hover:text-[var(--accent-primary-hover)] cursor-pointer",
        rel: "noopener noreferrer",
        target: "_blank",
      },
      validate: (href) => /^https?:\/\//.test(href),
    }),
    Image,
    TaskList,
    TaskItem.configure({
      nested: true,
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
    WikilinkExtension.configure({
      suggestion: createWikilinkSuggestion(),
    }),
  ];
}
