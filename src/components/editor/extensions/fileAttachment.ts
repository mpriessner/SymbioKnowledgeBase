import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileAttachmentView } from "@/components/editor/nodeViews/FileAttachmentView";

export interface FileAttachmentAttrs {
  attachmentId: string;
  name: string;
  size: number;
  mimeType: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      /** Insert a file-attachment card at the current selection. */
      insertFileAttachment: (attrs: FileAttachmentAttrs) => ReturnType;
    };
  }
}

/**
 * Leaf block node for a non-image file attachment (PDF, docx, …).
 *
 * Rendered as a compact card (icon, filename, size, download link) whose
 * download points at the tenant-scoped serving route. Uploaded images use the
 * existing image node instead — this node is only for non-image files.
 */
export const FileAttachment = Node.create({
  name: "fileAttachment",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-id") ?? "",
        renderHTML: (attributes) => ({
          "data-id": attributes.attachmentId as string,
        }),
      },
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-name") ?? "",
        renderHTML: (attributes) => ({
          "data-name": attributes.name as string,
        }),
      },
      size: {
        default: 0,
        parseHTML: (element) =>
          Number(element.getAttribute("data-size")) || 0,
        renderHTML: (attributes) => ({
          "data-size": String(attributes.size ?? 0),
        }),
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime") ?? "",
        renderHTML: (attributes) => ({
          "data-mime": attributes.mimeType as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-attachment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-attachment" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },

  addCommands() {
    return {
      insertFileAttachment:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name, attrs })
            .run();
        },
    };
  },
});
