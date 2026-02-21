"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useSaveDocument } from "@/hooks/useBlockEditor";
import type { SaveStatus } from "@/types/editor";

const DEFAULT_DEBOUNCE_MS = 1000;

interface UseAutoSaveOptions {
  editor: Editor | null;
  pageId: string;
  debounceMs?: number;
  onStatusChange?: (status: SaveStatus) => void;
}

export function useAutoSave({
  editor,
  pageId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onStatusChange,
}: UseAutoSaveOptions) {
  const saveDocument = useSaveDocument(pageId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<SaveStatus>("idle");

  // Update save status and notify callback
  const setStatus = useCallback(
    (status: SaveStatus) => {
      statusRef.current = status;
      onStatusChange?.(status);
    },
    [onStatusChange]
  );

  // Perform the actual save
  const performSave = useCallback(() => {
    if (!editor) return;

    const content = editor.getJSON();
    setStatus("saving");

    saveDocument.mutate(content, {
      onSuccess: () => {
        setStatus("saved");
      },
      onError: () => {
        setStatus("error");
      },
    });
  }, [editor, saveDocument, setStatus]);

  // Debounced save triggered by editor changes
  const debouncedSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [performSave, debounceMs]);

  // Immediate save (for Ctrl+S)
  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    performSave();
  }, [performSave]);

  // Listen to editor updates
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      debouncedSave();
    };

    editor.on("update", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor, debouncedSave]);

  // Handle Ctrl+S / Cmd+S for manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveNow]);

  // Save before unload (best-effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timerRef.current && editor) {
        clearTimeout(timerRef.current);
        // Use sendBeacon for reliable save on page exit
        const content = editor.getJSON();
        const blob = new Blob(
          [JSON.stringify({ content })],
          { type: "application/json" }
        );
        navigator.sendBeacon(`/api/pages/${pageId}/blocks`, blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editor, pageId]);

  return {
    saveNow,
    isSaving: saveDocument.isPending,
    isError: saveDocument.isError,
    status: statusRef.current,
  };
}
