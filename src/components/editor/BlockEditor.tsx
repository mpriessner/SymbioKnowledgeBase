"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { getBaseExtensions } from "@/lib/editor/editorConfig";
import { usePageBlocks } from "@/hooks/useBlockEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/editor/SaveStatusIndicator";
import type { SaveStatus } from "@/types/editor";
import "@/components/editor/editor.css";

interface BlockEditorProps {
  pageId: string;
  editable?: boolean;
}

export function BlockEditor({ pageId, editable = true }: BlockEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Fetch existing blocks for this page
  const { data: blocks, isLoading, isError } = usePageBlocks(pageId);

  // Extract the DOCUMENT block content (if it exists)
  const documentContent: JSONContent | undefined = blocks
    ?.find((b) => b.type === "DOCUMENT")
    ?.content as JSONContent | undefined;

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: getBaseExtensions(),
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-stone dark:prose-invert max-w-none min-h-[500px] px-8 py-4 focus:outline-none",
        "data-testid": "block-editor",
      },
    },
    content: undefined,
    autofocus: "end",
  });

  // Load content into editor when data arrives
  useEffect(() => {
    if (editor && documentContent && !editor.isDestroyed) {
      // Only set content if the editor is empty or this is initial load
      const currentContent = editor.getJSON();
      const isEmptyDoc =
        currentContent.content?.length === 1 &&
        currentContent.content[0].type === "paragraph" &&
        !currentContent.content[0].content;

      if (isEmptyDoc) {
        editor.commands.setContent(documentContent);
      }
    }
  }, [editor, documentContent]);

  // Auto-save hook
  const handleStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  useAutoSave({
    editor,
    pageId,
    debounceMs: 1000,
    onStatusChange: handleStatusChange,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-pulse text-[var(--text-tertiary)]">Loading editor...</div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-red-500">
          Failed to load page content. Please try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" data-testid="block-editor-container">
      {/* Save status indicator */}
      <div className="sticky top-0 z-10 flex justify-end px-8 py-2 bg-[var(--bg-primary)]/80 backdrop-blur-sm">
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* TipTap editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
