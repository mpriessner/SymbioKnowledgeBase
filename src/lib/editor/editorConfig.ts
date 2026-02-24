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
 * - Blockquote, HorizontalRule
 * - HardBreak, UndoRedo (100-step depth)
 * - Bold, Italic, Strike, Code (marks)
 *
 * CodeBlock is disabled in StarterKit — we use CodeBlockLowlight instead.
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
      // Disable built-in code block — we use CodeBlockLowlight instead
      codeBlock: false,
      // Disable built-in link — we configure our own Link extension below
      link: false,
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
    WikilinkExtension.configure({
      suggestion: createWikilinkSuggestion(),
    }),
  ];
}
