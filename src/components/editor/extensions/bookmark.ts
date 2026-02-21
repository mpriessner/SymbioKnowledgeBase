import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BookmarkView } from "@/components/editor/nodeViews/BookmarkView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      /** Insert a bookmark block */
      insertBookmark: (attrs: { url: string }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create({
  name: "bookmark",

  group: "block",

  atom: true,

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
