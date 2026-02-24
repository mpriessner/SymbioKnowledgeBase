import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import {
  WikilinkSuggestion,
  type WikilinkSuggestionRef,
} from "../WikilinkSuggestion";

/**
 * Custom function to find wikilink suggestion match.
 * Handles the [[ trigger and ensures the query doesn't include ]] closing brackets.
 */
function findWikilinkSuggestionMatch(config: {
  char: string;
  $position: { parent: { textContent: string }; parentOffset: number; pos: number };
}) {
  const { char, $position } = config;
  const textBefore = $position.parent.textContent.slice(0, $position.parentOffset);

  // Find the last occurrence of [[
  const triggerIndex = textBefore.lastIndexOf(char);
  if (triggerIndex === -1) {
    return null;
  }

  // Get the text after [[
  let query = textBefore.slice(triggerIndex + char.length);

  // If query contains ]], don't show suggestion (wikilink is closed)
  if (query.includes("]]")) {
    return null;
  }

  // Strip pipe and everything after (for display text syntax)
  const pipeIndex = query.indexOf("|");
  if (pipeIndex > -1) {
    query = query.slice(0, pipeIndex);
  }

  // Calculate the range
  const from = $position.pos - $position.parentOffset + triggerIndex;
  const to = $position.pos;

  return {
    range: { from, to },
    query: query.trim(),
    text: textBefore.slice(triggerIndex),
  };
}

/**
 * Creates the suggestion plugin configuration for wikilink autocomplete.
 *
 * This plugin:
 * 1. Detects when the user types "[["
 * 2. Captures subsequent keystrokes as the search query
 * 3. Renders a floating popup with page suggestions
 * 4. On selection, inserts a wikilink node with the chosen page's ID
 *
 * Uses tippy.js for positioning the floating popup near the cursor.
 */
export function createWikilinkSuggestion(): Omit<
  SuggestionOptions,
  "editor"
> {
  return {
    char: "[[",
    allowSpaces: true,
    findSuggestionMatch: findWikilinkSuggestionMatch,

    command: ({ editor, range, props }) => {
      const { id, title } = props as {
        id: string;
        title: string;
        icon: string | null;
      };

      // Check for pipe syntax: "Page Name|Display Text"
      const queryText = editor.state.doc.textBetween(
        range.from + 2, // Skip the [[ chars
        range.to
      );

      const pipeIndex = queryText.indexOf("|");
      let displayText: string | null = null;

      if (pipeIndex > -1) {
        displayText = queryText.substring(pipeIndex + 1).trim() || null;
      }

      // Delete the [[ trigger text and query, replace with wikilink node
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertWikilink({
          pageId: id,
          pageName: title,
          displayText,
        })
        .run();
    },

    render: () => {
      let component: ReactRenderer<WikilinkSuggestionRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(WikilinkSuggestion, {
            props: {
              query: props.query,
              onSelect: (page: {
                id: string;
                title: string;
                icon: string | null;
              }) => {
                props.command(page);
              },
              onClose: () => {
                popup?.[0]?.hide();
              },
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            offset: [0, 4],
          });
        },

        onUpdate(props: SuggestionProps) {
          component?.updateProps({
            query: props.query,
            onSelect: (page: {
              id: string;
              title: string;
              icon: string | null;
            }) => {
              props.command(page);
            },
          });

          if (props.clientRect) {
            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          }
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }

          return component?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}
