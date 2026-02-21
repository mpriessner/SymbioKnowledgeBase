import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutView } from "@/components/editor/nodeViews/CalloutView";

export type CalloutVariant = "info" | "warning" | "success" | "error";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Insert a callout block */
      insertCallout: (attrs?: {
        emoji?: string;
        variant?: CalloutVariant;
      }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "\u{1F4A1}",
        parseHTML: (element) =>
          element.getAttribute("data-emoji") ?? "\u{1F4A1}",
        renderHTML: (attributes) => ({
          "data-emoji": attributes.emoji as string,
        }),
      },
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (element) =>
          (element.getAttribute("data-variant") as CalloutVariant) ?? "info",
        renderHTML: (attributes) => ({
          "data-variant": attributes.variant as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      insertCallout:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                emoji: attrs?.emoji ?? "\u{1F4A1}",
                variant: attrs?.variant ?? "info",
              },
              content: [
                {
                  type: "paragraph",
                  content: [],
                },
              ],
            })
            .run();
        },
    };
  },
});
