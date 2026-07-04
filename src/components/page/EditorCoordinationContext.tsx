"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import type { JSONContent } from "@tiptap/react";

/**
 * Imperative handle the block editor exposes so a sibling component (the page
 * history panel) can coordinate a version restore against live autosave.
 *
 * The panel and the editor live in different React subtrees (the panel opens
 * from the breadcrumb page actions; the editor is inside the page content), so
 * they can't share hook state directly. This registry — provided once at the
 * workspace layout — is the bridge: the editor registers its controller per
 * pageId, and the panel looks it up when the user restores a version.
 */
export interface AutosaveController {
  /** Pause autosave: no new saves start and no content is parked. */
  suspend: () => void;
  /** Resume autosave after a restore completes. */
  resume: () => void;
  /** Drop any queued/parked content so it can't flush over restored content. */
  clearPending: () => void;
  /** Resolve once any in-flight save has settled. */
  waitForInFlight: () => Promise<void>;
  /** Push restored content into the editor and realign the concurrency token. */
  applyRestoredContent: (content: JSONContent, blockVersion: number) => void;
}

interface EditorCoordinationRegistry {
  register: (pageId: string, controller: AutosaveController) => void;
  unregister: (pageId: string) => void;
  get: (pageId: string) => AutosaveController | undefined;
}

const EditorCoordinationCtx = createContext<EditorCoordinationRegistry | null>(
  null
);

export function EditorCoordinationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const mapRef = useRef<Map<string, AutosaveController>>(new Map());

  const register = useCallback(
    (pageId: string, controller: AutosaveController) => {
      mapRef.current.set(pageId, controller);
    },
    []
  );
  const unregister = useCallback((pageId: string) => {
    mapRef.current.delete(pageId);
  }, []);
  const get = useCallback(
    (pageId: string) => mapRef.current.get(pageId),
    []
  );

  return (
    <EditorCoordinationCtx.Provider value={{ register, unregister, get }}>
      {children}
    </EditorCoordinationCtx.Provider>
  );
}

/** Access the editor-coordination registry, or null if no provider is mounted. */
export function useEditorCoordination(): EditorCoordinationRegistry | null {
  return useContext(EditorCoordinationCtx);
}
