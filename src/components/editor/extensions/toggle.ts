import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ToggleView } from "@/components/editor/nodeViews/ToggleView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggle: {
      /** Insert a toggle block */
      insertToggle: () => ReturnType;
      /** Toggle the open/closed state */
      toggleOpen: (pos: number) => ReturnType;
    };
  }
}

export const Toggle = Node.create({
  name: "toggle",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      isOpen: {
        default: true,
        parseHTML: (element) =>
          element.getAttribute("data-is-open") !== "false",
        renderHTML: (attributes) => ({
          "data-is-open": attributes.isOpen as boolean,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      insertToggle:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { isOpen: true },
              content: [
                {
                  type: "paragraph",
                },
              ],
            })
            .run();
        },
      toggleOpen:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              isOpen: !node.attrs.isOpen,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
