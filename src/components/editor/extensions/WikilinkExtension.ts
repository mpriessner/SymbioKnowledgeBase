import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { WikilinkNodeView } from "../WikilinkNodeView";

export interface WikilinkAttributes {
  pageId: string;
  pageName: string;
  displayText: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikilink: (attrs: WikilinkAttributes) => ReturnType;
    };
  }
}

/**
 * TipTap Node extension for wikilinks.
 *
 * Renders inline wikilink nodes that store a reference to another page
 * by pageId. The node displays either the pageName or a custom displayText.
 *
 * Also integrates the suggestion plugin to trigger autocomplete on "[[".
 */
export const WikilinkExtension = Node.create({
  name: "wikilink",

  group: "inline",

  inline: true,

  atom: true,

  selectable: true,

  draggable: false,

  addOptions() {
    return {
      suggestion: {
        char: "[[",
        allowSpaces: true,
      } as Partial<SuggestionOptions>,
    };
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-page-id"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-page-id": attributes.pageId as string,
        }),
      },
      pageName: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-page-name"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-page-name": attributes.pageName as string,
        }),
      },
      displayText: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-display-text"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-display-text": attributes.displayText as string | null,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wikilink",
        class: "wikilink",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikilinkNodeView);
  },

  addCommands() {
    return {
      insertWikilink:
        (attrs: WikilinkAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        pluginKey: new PluginKey("wikilinkSuggestion"),
      }),
    ];
  },
});
