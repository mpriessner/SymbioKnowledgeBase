"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent, Editor } from "@tiptap/react";
import { getBaseExtensions } from "@/lib/editor/editorConfig";
import { usePageBlocks } from "@/hooks/useBlockEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEditorCoordination } from "@/components/page/EditorCoordinationContext";
import { SaveStatusIndicator } from "@/components/editor/SaveStatusIndicator";
import { FormattingToolbar } from "@/components/editor/FormattingToolbar";
import { BlockActionMenu } from "@/components/editor/BlockActionMenu";
import { ImageInsertDialog } from "@/components/editor/ImageInsertDialog";
import { ToastContainer } from "@/components/ui/Toast";
import { useAttachmentUpload } from "@/hooks/useAttachmentUpload";
import type { SaveStatus } from "@/types/editor";
import "@/components/editor/editor.css";

interface BlockEditorProps {
  pageId: string;
  editable?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

interface MenuState {
  isOpen: boolean;
  blockPos: number;
  x: number;
  y: number;
}

export function BlockEditor({ pageId, editable = true, onEditorReady }: BlockEditorProps) {
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [menuState, setMenuState] = useState<MenuState>({
    isOpen: false,
    blockPos: 0,
    x: 0,
    y: 0,
  });

  // Fetch existing blocks for this page
  const { data: blocks, isLoading, isError } = usePageBlocks(pageId);

  // Extract the DOCUMENT block content (if it exists)
  const documentContent: JSONContent | undefined = blocks
    ?.find((b) => b.type === "DOCUMENT")
    ?.content as JSONContent | undefined;

  // Handle drag handle click to open block action menu
  const handleDragHandleClick = useCallback(
    (pos: number, event: MouseEvent) => {
      setMenuState({
        isOpen: true,
        blockPos: pos,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const handleMenuClose = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: getBaseExtensions({
      onDragHandleClick: handleDragHandleClick,
    }),
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-stone dark:prose-invert w-full max-w-none content-pad py-4 focus:outline-none",
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
        // Defer to avoid flushSync inside React lifecycle
        queueMicrotask(() => {
          if (!editor.isDestroyed) {
            editor.commands.setContent(documentContent);
          }
        });
      }
    }
  }, [editor, documentContent]);

  // Notify parent when editor instance is ready
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      onEditorReadyRef.current?.(editor);
    }
  }, [editor]);

  // Attachment upload orchestration (drag-drop, paste, slash-menu Image/File)
  const {
    toasts,
    removeToast,
    uploads,
    imageDialogOpen,
    setImageDialogOpen,
    pickImageFile,
    embedImageUrl,
  } = useAttachmentUpload(editor, pageId);

  // Auto-save hook
  const handleStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  const { controller } = useAutoSave({
    editor,
    pageId,
    debounceMs: 1000,
    onStatusChange: handleStatusChange,
  });

  // Register the autosave controller so the page history panel (a separate
  // subtree) can coordinate a restore against live autosave.
  const coordination = useEditorCoordination();
  useEffect(() => {
    if (!coordination) return;
    coordination.register(pageId, controller);
    return () => coordination.unregister(pageId);
  }, [coordination, pageId, controller]);

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
      <div className="sticky top-0 z-10 flex justify-end content-pad py-2 bg-[var(--bg-primary)]/80 backdrop-blur-sm">
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* TipTap editor */}
      <EditorContent editor={editor} />

      {/* Floating formatting toolbar — appears on text selection */}
      {editor && <FormattingToolbar editor={editor} />}

      {/* Block action menu (triggered by drag handle click) */}
      {menuState.isOpen && editor && (
        <BlockActionMenu
          editor={editor}
          blockPos={menuState.blockPos}
          anchorX={menuState.x}
          anchorY={menuState.y}
          onClose={handleMenuClose}
        />
      )}

      {/* Slash-menu Image dialog (upload or embed by URL) */}
      <ImageInsertDialog
        isOpen={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onUploadClick={pickImageFile}
        onEmbedUrl={embedImageUrl}
      />

      {/* Transient upload progress overlay (no placeholder nodes) */}
      {uploads.length > 0 && (
        <div
          className="fixed bottom-4 left-4 z-40 flex flex-col gap-2"
          data-testid="attachment-upload-overlay"
        >
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 shadow-lg"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)]" />
              <span className="max-w-[16rem] truncate text-sm text-[var(--text-primary)]">
                Uploading {u.name}…
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload failure toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
