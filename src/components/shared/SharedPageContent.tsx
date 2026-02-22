"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { getBaseExtensions } from "@/lib/editor/editorConfig";
import "@/components/editor/editor.css";

interface SharedPageContentProps {
  content: Record<string, unknown>;
}

export function SharedPageContent({ content }: SharedPageContentProps) {
  const editor = useEditor({
    extensions: getBaseExtensions({}),
    editable: false,
    immediatelyRender: false,
    content: content as JSONContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-stone dark:prose-invert max-w-none px-0 py-4 focus:outline-none",
      },
    },
  });

  if (!editor) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full" />
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3" />
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2" />
      </div>
    );
  }

  return <EditorContent editor={editor} />;
}
