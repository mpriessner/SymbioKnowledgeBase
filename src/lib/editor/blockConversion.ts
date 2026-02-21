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
 * Filters out the current block type.
 */
export function getAvailableConversions(
  editor: Editor
): ConversionOption[] {
  const currentType = getCurrentBlockType(editor);
  if (!currentType) return conversionOptions;

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

  const isInList =
    editor.isActive("bulletList") ||
    editor.isActive("orderedList") ||
    editor.isActive("taskList");

  switch (targetType) {
    case "paragraph":
      if (isInList) {
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
      chain.toggleBulletList().run();
      return true;

    case "orderedList":
      chain.toggleOrderedList().run();
      return true;

    case "taskList":
      chain.toggleTaskList().run();
      return true;

    case "blockquote":
      if (isInList) {
        chain.liftListItem("listItem").toggleBlockquote().run();
      } else {
        chain.toggleBlockquote().run();
      }
      return true;

    case "callout": {
      if (isInList) {
        chain.liftListItem("listItem").run();
      }
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, " ");
      chain
        .insertContent({
          type: "callout",
          attrs: { emoji: "\u{1F4A1}", variant: "info" },
          content: [
            {
              type: "paragraph",
              content: text ? [{ type: "text", text }] : [],
            },
          ],
        })
        .run();
      return true;
    }

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
