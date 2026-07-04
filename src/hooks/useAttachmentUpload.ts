"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useToast } from "@/hooks/useToast";

/** A file currently being uploaded (shown in the transient overlay). */
export interface UploadEntry {
  id: string;
  name: string;
}

interface UploadResponse {
  attachmentId: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Orchestrates attachment uploads for the block editor.
 *
 * Upload-first: a node is inserted ONLY after the upload succeeds, so a
 * navigation mid-upload can never persist a broken placeholder node. Progress
 * is surfaced via a transient overlay (returned `uploads`) and failures via a
 * toast — never via a document node.
 *
 * The hook also publishes its openers onto the editor's `attachmentUpload`
 * storage so the slash-menu Image/File entries and the drag-drop/paste plugin
 * can reach them.
 */
export function useAttachmentUpload(editor: Editor | null, pageId: string) {
  const { toasts, addToast, removeToast } = useToast();
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const uploadFiles = useCallback(
    async (files: File[], pos: number | null) => {
      for (const file of files) {
        const entryId = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;
        setUploads((prev) => [...prev, { id: entryId, name: file.name }]);

        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`/api/pages/${pageId}/attachments`, {
            method: "POST",
            body: formData,
          });
          const json = (await res.json().catch(() => null)) as
            | { data?: UploadResponse; error?: { message?: string } }
            | null;

          if (!res.ok || !json?.data) {
            const msg = json?.error?.message ?? "Upload failed";
            addToast(`${file.name}: ${msg}`, "error");
            continue;
          }

          const data = json.data;
          const ed = editorRef.current;
          if (ed && !ed.isDestroyed) {
            const isImage = data.mimeType.startsWith("image/");
            const node = isImage
              ? {
                  type: "image",
                  attrs: { src: data.url, alt: data.fileName },
                }
              : {
                  type: "fileAttachment",
                  attrs: {
                    attachmentId: data.attachmentId,
                    name: data.fileName,
                    size: data.fileSize,
                    mimeType: data.mimeType,
                  },
                };

            const docSize = ed.state.doc.content.size;
            if (pos !== null && pos >= 0 && pos <= docSize) {
              ed.chain().focus().insertContentAt(pos, node).run();
            } else {
              ed.chain().focus().insertContent(node).run();
            }
          }
        } catch {
          addToast(`${file.name}: Upload failed`, "error");
        } finally {
          setUploads((prev) => prev.filter((u) => u.id !== entryId));
        }
      }
    },
    [pageId, addToast]
  );

  // Open a native file picker (optionally restricted to images) and upload.
  const triggerFilePicker = useCallback(
    (accept: string | null) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      if (accept) input.accept = accept;
      input.addEventListener("change", () => {
        const files = input.files ? Array.from(input.files) : [];
        if (files.length > 0) void uploadFiles(files, null);
      });
      input.click();
    },
    [uploadFiles]
  );

  const openImageDialog = useCallback(() => setImageDialogOpen(true), []);
  const openFilePicker = useCallback(
    () => triggerFilePicker(null),
    [triggerFilePicker]
  );
  const pickImageFile = useCallback(
    () => triggerFilePicker("image/*"),
    [triggerFilePicker]
  );

  const embedImageUrl = useCallback((url: string) => {
    const ed = editorRef.current;
    if (ed && !ed.isDestroyed && url) {
      ed.chain().focus().setImage({ src: url }).run();
    }
    setImageDialogOpen(false);
  }, []);

  // Publish openers/uploader onto the editor storage for the plugin + slash menu.
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.attachmentUpload;
    if (!storage) return;

    storage.uploadFiles = (files: File[], pos: number | null) => {
      void uploadFiles(files, pos);
    };
    storage.openImageDialog = openImageDialog;
    storage.openFilePicker = openFilePicker;

    return () => {
      const s = editor.storage.attachmentUpload;
      if (s) {
        s.uploadFiles = null;
        s.openImageDialog = null;
        s.openFilePicker = null;
      }
    };
  }, [editor, uploadFiles, openImageDialog, openFilePicker]);

  return {
    toasts,
    removeToast,
    uploads,
    imageDialogOpen,
    setImageDialogOpen,
    pickImageFile,
    embedImageUrl,
  };
}
