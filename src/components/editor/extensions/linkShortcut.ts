import { Extension } from "@tiptap/core";

/**
 * Adds Cmd/Ctrl+K keyboard shortcut to trigger link editing.
 *
 * Dispatches a custom DOM event that the FormattingToolbar
 * listens for to show its link input UI.
 */
export const LinkShortcut = Extension.create({
  name: "linkShortcut",

  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        const event = new CustomEvent("tiptap:open-link-input", {
          bubbles: true,
        });
        this.editor.view.dom.dispatchEvent(event);

        // If there's no selection, just return
        const { from, to } = this.editor.state.selection;
        if (from === to) return false;

        return true;
      },
    };
  },
});
