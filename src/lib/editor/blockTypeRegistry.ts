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
      // Toggle blocks will be implemented in a later story; for now insert a blockquote as placeholder
      editor.chain().focus().toggleBlockquote().run();
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
      // Callout extension will be added in a later story; for now insert a blockquote
      editor.chain().focus().toggleBlockquote().run();
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
          .insertContent(`<p><a href="${url}">${url}</a></p>`)
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
