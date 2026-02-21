import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  filterBlockTypes,
  type BlockTypeItem,
} from "@/lib/editor/blockTypeRegistry";
import { SlashMenu, type SlashMenuRef } from "@/components/editor/SlashMenu";

/**
 * Slash Command extension for TipTap.
 *
 * Triggers on "/" character and opens a floating menu of block types.
 * Uses TipTap's Suggestion plugin for cursor tracking and lifecycle,
 * ReactRenderer for rendering the React component, and Tippy.js
 * for floating positioning.
 */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: SuggestionProps["editor"];
          range: SuggestionProps["range"];
          props: BlockTypeItem;
        }) => {
          // Delete the "/" trigger and any filter text
          editor.chain().focus().deleteRange(range).run();
          // Execute the block type command
          props.command(editor);
        },
      } as Partial<SuggestionOptions<BlockTypeItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<BlockTypeItem>({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query }: { query: string }) => {
          return filterBlockTypes(query);
        },

        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps<BlockTypeItem>) => {
              component = new ReactRenderer(SlashMenu, {
                props: {
                  items: props.items,
                  command: (item: BlockTypeItem) => {
                    props.command(item);
                  },
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect:
                  props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                animation: "shift-away",
                maxWidth: "none",
              });
            },

            onUpdate: (props: SuggestionProps<BlockTypeItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: BlockTypeItem) => {
                  props.command(item);
                },
              });

              if (popup && props.clientRect) {
                popup[0]?.setProps({
                  getReferenceClientRect:
                    props.clientRect as () => DOMRect,
                });
              }
            },

            onKeyDown: (props: { event: KeyboardEvent }) => {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }

              return (
                component?.ref?.onKeyDown(props) ?? false
              );
            },

            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
