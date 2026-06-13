"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { useSaveDocument } from "@/hooks/useBlockEditor";
import type { SaveStatus } from "@/types/editor";

const DEFAULT_DEBOUNCE_MS = 1000;

interface UseAutoSaveOptions {
  editor: Editor | null;
  pageId: string;
  debounceMs?: number;
  onStatusChange?: (status: SaveStatus) => void;
  /** Notified when a save is rejected as a conflict (server moved on). */
  onConflict?: () => void;
}

export function useAutoSave({
  editor,
  pageId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onStatusChange,
  onConflict,
}: UseAutoSaveOptions) {
  const saveDocument = useSaveDocument(pageId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use state instead of ref so status changes trigger re-renders
  const [status, setStatusState] = useState<SaveStatus>("idle");

  // Serialization state. We never allow two PUTs in flight at once: while one
  // save is running, the newest content is parked in `pendingRef`; when the
  // in-flight save settles we immediately flush that pending content. This
  // guarantees ordered writes and "latest content wins" even when edits
  // outpace the network.
  const inFlightRef = useRef(false);
  const pendingRef = useRef<JSONContent | null>(null);

  // Keep stable refs to callbacks so the save loop doesn't churn. Assigned in
  // effects (not during render) so they always reflect the latest props.
  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    onConflictRef.current = onConflict;
  }, [onConflict]);

  // Update save status and notify callback
  const setStatus = useCallback(
    (newStatus: SaveStatus) => {
      setStatusState(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );
  const setStatusRef = useRef(setStatus);
  useEffect(() => {
    setStatusRef.current = setStatus;
  }, [setStatus]);

  // Stable reference to the save fn so the flush loop can recurse without a
  // self-referential useCallback (which the rules-of-hooks linter rejects) and
  // without re-subscribing editor listeners.
  const saveNowFnRef = useRef(saveDocument.saveNow);
  useEffect(() => {
    saveNowFnRef.current = saveDocument.saveNow;
  }, [saveDocument.saveNow]);

  // Flush a specific content snapshot through the serialized save pipeline.
  // Recurses via flushSaveRef so only the latest parked content is written
  // once an in-flight save settles ("latest content wins", ordered writes).
  const flushSaveRef = useRef<(content: JSONContent) => void>(() => {});
  useEffect(() => {
    flushSaveRef.current = (content: JSONContent) => {
      // A save is already running — park the latest content and let the
      // completion handler pick it up. This supersedes any older pending
      // snapshot so only the newest content is written next.
      if (inFlightRef.current) {
        pendingRef.current = content;
        return;
      }

      inFlightRef.current = true;
      setStatusRef.current("saving");

      saveNowFnRef.current(content, {
        onSuccess: () => {
          inFlightRef.current = false;
          // If newer content arrived mid-flight, write it next.
          if (pendingRef.current) {
            const next = pendingRef.current;
            pendingRef.current = null;
            flushSaveRef.current(next);
          } else {
            setStatusRef.current("saved");
          }
        },
        onError: (error) => {
          inFlightRef.current = false;
          setStatusRef.current("error");
          if ((error as { isConflict?: boolean })?.isConflict) {
            onConflictRef.current?.();
          }
          // Even after an error, if the user kept typing, attempt the newest
          // content so a transient failure doesn't strand later edits.
          if (pendingRef.current) {
            const next = pendingRef.current;
            pendingRef.current = null;
            flushSaveRef.current(next);
          }
        },
      });
    };
  }, []);

  // Capture the editor's current content and push it through the pipeline.
  const performSave = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    flushSaveRef.current(editor.getJSON());
  }, [editor]);

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

  // Best-effort save on page exit. We flush on BOTH `visibilitychange→hidden`
  // (fires reliably on mobile/tab-switch where `beforeunload` often doesn't)
  // and `beforeunload`. Crucially we flush the CURRENT dirty content directly
  // rather than gating on a pending debounce timer — the previous version only
  // saved if a timer happened to be queued, silently dropping the last edit
  // when the debounce had already fired but the user kept the tab open briefly.
  useEffect(() => {
    if (!editor) return;

    const beaconSave = () => {
      if (editor.isDestroyed) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const content = editor.getJSON();
      const blob = new Blob([JSON.stringify({ content })], {
        type: "application/json",
      });
      navigator.sendBeacon(`/api/pages/${pageId}/blocks`, blob);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        beaconSave();
      }
    };

    window.addEventListener("beforeunload", beaconSave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", beaconSave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [editor, pageId]);

  return {
    saveNow,
    isSaving: saveDocument.isPending,
    isError: saveDocument.isError,
    isConflict: saveDocument.isConflict,
    status,
  };
}
