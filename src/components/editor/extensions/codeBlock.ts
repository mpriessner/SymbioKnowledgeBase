import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { CodeBlockView } from "@/components/editor/nodeViews/CodeBlockView";

// Import additional languages beyond the "common" set
import typescript from "highlight.js/lib/languages/typescript";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";

// Create lowlight instance with curated languages
const lowlight = createLowlight(common);
lowlight.register("typescript", typescript);
lowlight.register("go", go);
lowlight.register("rust", rust);

/**
 * Supported languages for the code block language selector.
 * Each entry maps a display name to the lowlight language ID.
 */
export const SUPPORTED_LANGUAGES = [
  { label: "Plain Text", value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
  { label: "SQL", value: "sql" },
  { label: "JSON", value: "json" },
  { label: "HTML", value: "xml" }, // lowlight uses "xml" for HTML
  { label: "CSS", value: "css" },
  { label: "Bash", value: "bash" },
  { label: "Markdown", value: "markdown" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["value"];

/**
 * Configured CodeBlockLowlight extension with:
 * - Syntax highlighting via lowlight
 * - React node view for language selector and copy button
 * - Tab handling (insert spaces instead of changing focus)
 */
export const ConfiguredCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  addKeyboardShortcuts() {
    return {
      // Tab inserts 2 spaces in code blocks
      Tab: ({ editor }) => {
        if (editor.isActive("codeBlock")) {
          editor.commands.insertContent("  ");
          return true;
        }
        return false;
      },
      // Shift+Tab: prevent default
      "Shift-Tab": ({ editor }) => {
        if (editor.isActive("codeBlock")) {
          return true;
        }
        return false;
      },
    };
  },
}).configure({
  lowlight,
  defaultLanguage: "javascript",
  HTMLAttributes: {
    class: "code-block",
  },
});
