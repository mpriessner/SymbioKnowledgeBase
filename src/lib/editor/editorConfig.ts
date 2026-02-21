import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Extensions } from "@tiptap/react";

// Default placeholder text for empty editor
const DEFAULT_PLACEHOLDER = "Type '/' for commands...";

export interface EditorConfigOptions {
  placeholder?: string;
}

/**
 * Returns the base TipTap extensions for the block editor.
 *
 * StarterKit includes:
 * - Document, Paragraph, Text (core)
 * - Heading (H1-H3 configured)
 * - BulletList, OrderedList, ListItem
 * - Blockquote
 * - HorizontalRule
 * - HardBreak
 * - History (undo/redo)
 * - Bold, Italic, Strike, Code (marks)
 */
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
  ];
}
