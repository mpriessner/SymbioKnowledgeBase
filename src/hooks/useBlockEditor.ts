"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import type { Block } from "@/types/editor";
import type { ApiResponse } from "@/types/api";

// Query key factory for blocks
export const blockKeys = {
  all: ["blocks"] as const,
  byPage: (pageId: string) => ["blocks", "page", pageId] as const,
  byId: (blockId: string) => ["blocks", blockId] as const,
};

// Server rows carry an optimistic-concurrency `version` that the shared Block
// type doesn't expose. Narrow locally so we can read/track it without touching
// the shared type.
type VersionedBlock = Block & { version?: number };

interface PageBlocksResponse {
  data: VersionedBlock[];
  meta: { count: number; pageId: string; timestamp: string };
}

/**
 * Error thrown when a save is rejected because the document changed on the
 * server since the client last loaded it (HTTP 409). Carries a flag so the UI
 * can distinguish a recoverable conflict from a generic failure.
 */
export class SaveConflictError extends Error {
  readonly isConflict = true;
  constructor(message: string) {
    super(message);
    this.name = "SaveConflictError";
  }
}

// Fetch all blocks for a page
async function fetchPageBlocks(pageId: string): Promise<VersionedBlock[]> {
  const res = await fetch(`/api/pages/${pageId}/blocks`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || `Failed to fetch blocks: ${res.status}`);
  }
  const json: PageBlocksResponse = await res.json();
  return json.data;
}

// Save full TipTap document for a page. Sends the last-observed `version` for
// optimistic-concurrency; a 409 means the server moved on and is surfaced as a
// recoverable SaveConflictError rather than a generic failure.
async function savePageDocument(
  pageId: string,
  content: JSONContent,
  expectedVersion?: number
): Promise<VersionedBlock> {
  const res = await fetch(`/api/pages/${pageId}/blocks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      expectedVersion === undefined ? { content } : { content, expectedVersion }
    ),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    const message =
      error?.error?.message || `Failed to save document: ${res.status}`;
    if (res.status === 409) {
      throw new SaveConflictError(message);
    }
    throw new Error(message);
  }
  const json: ApiResponse<VersionedBlock> = await res.json();
  return json.data;
}

// Hook: Load page blocks
export function usePageBlocks(pageId: string) {
  return useQuery({
    queryKey: blockKeys.byPage(pageId),
    queryFn: () => fetchPageBlocks(pageId),
    enabled: !!pageId,
    staleTime: 30_000, // 30 seconds before refetch
  });
}

// Result surfaced to the editor for each save.
export interface SaveDocumentResult {
  saveNow: (
    content: JSONContent,
    options?: { onSuccess?: () => void; onError?: (error: Error) => void }
  ) => void;
  /**
   * Align local concurrency state with an out-of-band write (e.g. a version
   * restore that wrote content back to the DOCUMENT block on the server).
   * Sets the tracked `version` token and reconciles the blocks cache so the
   * next autosave is checked against the post-restore version.
   */
  applyExternalUpdate: (content: JSONContent, version: number) => void;
  isPending: boolean;
  isError: boolean;
  isConflict: boolean;
  error: Error | null;
}

/**
 * Hook: Save the page document.
 *
 * Concurrency model:
 * - Tracks the last server-confirmed `version` in a ref (seeded lazily from
 *   the blocks cache) and sends it with every save so the server can detect a
 *   conflicting concurrent write (→ 409 → SaveConflictError).
 * - Optimistically writes the new content into the cache so the editor reflects
 *   it immediately.
 * - On a TRANSIENT (non-conflict) error we deliberately KEEP the user's content
 *   in the cache instead of rolling back to the pre-edit snapshot — rolling
 *   back would erase what the user just typed.
 * - We do NOT invalidate the blocks query on settle. A background refetch can
 *   resurrect stale server content over newer in-editor text; the optimistic
 *   cache + version tracking already keep us consistent. On a real conflict the
 *   caller refetches explicitly.
 */
export function useSaveDocument(pageId: string): SaveDocumentResult {
  const queryClient = useQueryClient();
  // Last version we know the server has. undefined = "not yet known" → send no
  // version on the first save (server falls back to last-write-wins and
  // returns the authoritative version, which we then track).
  const versionRef = useRef<number | undefined>(undefined);

  const readCachedVersion = useCallback((): number | undefined => {
    const cached = queryClient.getQueryData<VersionedBlock[]>(
      blockKeys.byPage(pageId)
    );
    const doc = cached?.find((b) => b.type === "DOCUMENT");
    return doc?.version;
  }, [queryClient, pageId]);

  const mutation = useMutation({
    mutationFn: (content: JSONContent) => {
      // Prefer the in-ref version; fall back to whatever the cache last saw.
      const expected = versionRef.current ?? readCachedVersion();
      return savePageDocument(pageId, content, expected);
    },
    onMutate: async (newContent) => {
      // Stop in-flight refetches from overwriting our optimistic write.
      await queryClient.cancelQueries({ queryKey: blockKeys.byPage(pageId) });

      const previousBlocks = queryClient.getQueryData<VersionedBlock[]>(
        blockKeys.byPage(pageId)
      );

      if (previousBlocks) {
        const documentBlock = previousBlocks.find((b) => b.type === "DOCUMENT");
        if (documentBlock) {
          const updated = previousBlocks.map((b) =>
            b.type === "DOCUMENT"
              ? {
                  ...b,
                  content: newContent,
                  updatedAt: new Date().toISOString(),
                }
              : b
          );
          queryClient.setQueryData(blockKeys.byPage(pageId), updated);
        }
      }

      return { previousBlocks };
    },
    onSuccess: (savedBlock) => {
      // Track the authoritative version so the next save is checked against it.
      if (typeof savedBlock.version === "number") {
        versionRef.current = savedBlock.version;
      }
      // Reconcile the cache. If a DOCUMENT block already exists we update its
      // version/timestamps WITHOUT discarding content the user may still be
      // editing. If none exists — the first save of a brand-new/empty page —
      // we INSERT the authoritative saved block, so navigating back to the page
      // shows the just-saved content instead of an empty editor. (The
      // flush-on-unmount path in useAutoSave depends on this for fresh pages:
      // without it, a fast A → B → A switch on a new page would persist to the
      // DB but still render blank from the stale cache.)
      queryClient.setQueryData<VersionedBlock[]>(
        blockKeys.byPage(pageId),
        (current) => {
          const list = current ?? [];
          const hasDocumentBlock = list.some((b) => b.type === "DOCUMENT");
          if (hasDocumentBlock) {
            return list.map((b) =>
              b.type === "DOCUMENT"
                ? {
                    ...b,
                    version: savedBlock.version ?? b.version,
                    updatedAt: savedBlock.updatedAt ?? b.updatedAt,
                  }
                : b
            );
          }
          return [...list, savedBlock];
        }
      );
    },
    onError: (err, _newContent, context) => {
      // On a CONFLICT, roll the cache back to the last server-confirmed state
      // so the editor boundary / caller can prompt a reload against fresh data.
      // On a transient error, KEEP the user's content (do not roll back).
      if (err instanceof SaveConflictError && context?.previousBlocks) {
        queryClient.setQueryData(
          blockKeys.byPage(pageId),
          context.previousBlocks
        );
      }
    },
  });

  // Keep a stable reference to `mutate` so `saveNow` doesn't change identity on
  // every render. Consumers (useAutoSave) subscribe/unsubscribe editor
  // listeners keyed on this callback; an unstable identity would tear down a
  // pending debounce timer mid-edit and drop the save.
  const mutateRef = useRef(mutation.mutate);
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  const saveNow = useCallback(
    (
      content: JSONContent,
      options?: { onSuccess?: () => void; onError?: (error: Error) => void }
    ) => {
      mutateRef.current(content, {
        onSuccess: () => options?.onSuccess?.(),
        onError: (error) => options?.onError?.(error as Error),
      });
    },
    []
  );

  const applyExternalUpdate = useCallback(
    (content: JSONContent, version: number) => {
      versionRef.current = version;
      queryClient.setQueryData<VersionedBlock[]>(
        blockKeys.byPage(pageId),
        (current) => {
          const list = current ?? [];
          return list.map((b) =>
            b.type === "DOCUMENT"
              ? {
                  ...b,
                  content,
                  version,
                  updatedAt: new Date().toISOString(),
                }
              : b
          );
        }
      );
    },
    [queryClient, pageId]
  );

  return {
    saveNow,
    applyExternalUpdate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isConflict: mutation.error instanceof SaveConflictError,
    error: (mutation.error as Error) ?? null,
  };
}
