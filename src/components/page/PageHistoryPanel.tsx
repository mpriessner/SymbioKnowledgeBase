"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { History, RotateCcw, X } from "lucide-react";
import {
  usePageHistory,
  usePageVersionDetail,
  useRestoreVersion,
  historyKeys,
  type HistoryVersion,
} from "@/hooks/usePageHistory";
import { usePageBlocks, blockKeys } from "@/hooks/useBlockEditor";
import { computeTextDiff } from "@/lib/livingDocs/diff";
import { useEditorCoordination } from "@/components/page/EditorCoordinationContext";

interface PageHistoryPanelProps {
  pageId: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Extract plain text from a TipTap JSON doc (client-safe; no server imports). */
function extractText(node: JSONContent | null | undefined): string {
  if (!node) return "";
  const parts: string[] = [];
  const walk = (n: JSONContent) => {
    if (typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Format an ISO timestamp as a compact relative time ("3m ago", "2d ago"). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function changeTypeLabel(v: HistoryVersion): string {
  if (v.change_notes) return v.change_notes;
  switch (v.change_type) {
    case "MANUAL":
      return "Edit";
    case "AUTO_SYNC":
      return "Synced";
    case "MACHINE_UPDATE":
      return "Machine update";
    case "AI_SUGGESTED":
      return "AI suggestion";
    case "PROPAGATED":
      return "Propagated";
    default:
      return v.change_type;
  }
}

export function PageHistoryPanel({
  pageId,
  isOpen,
  onClose,
}: PageHistoryPanelProps) {
  const queryClient = useQueryClient();
  const coordination = useEditorCoordination();
  const { data: versions, isLoading, isError } = usePageHistory(pageId, isOpen);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Default the selection to the newest version once the list loads.
  const effectiveVersion =
    selectedVersion ?? (versions && versions.length > 0 ? versions[0].version : null);

  const { data: detail } = usePageVersionDetail(
    pageId,
    effectiveVersion,
    isOpen
  );
  const restore = useRestoreVersion(pageId);

  // Current live content (for the "diff vs current" view).
  const { data: blocks } = usePageBlocks(pageId);
  const currentText = useMemo(() => {
    const doc = blocks?.find((b) => b.type === "DOCUMENT");
    return extractText(doc?.content as JSONContent | undefined);
  }, [blocks]);

  // Word-level diff of the selected version vs the current live content.
  const diff = useMemo(() => {
    if (!detail) return null;
    return computeTextDiff(detail.plain_text, currentText);
  }, [detail, currentText]);

  const handleRestore = useCallback(async () => {
    if (effectiveVersion === null || !detail) return;
    setRestoreError(null);
    setIsRestoring(true);

    const controller = coordination?.get(pageId);
    // Restore-vs-autosave protocol: suspend autosave, drop any parked pre-restore
    // edit, and let any in-flight save settle BEFORE calling restore — otherwise
    // the parked edit would flush with the fresh token and undo the restore.
    if (controller) {
      controller.suspend();
      controller.clearPending();
      await controller.waitForInFlight();
    }

    try {
      const result = await restore.mutateAsync(effectiveVersion);
      if (controller) {
        // Apply restored content into the editor + realign concurrency token.
        controller.applyRestoredContent(detail.content, result.block_version);
        controller.resume();
      } else {
        // No live editor registered — reconcile the cache and reload instead.
        queryClient.setQueryData(blockKeys.byPage(pageId), (current) => {
          const list = (current as Array<{ type: string }> | undefined) ?? [];
          return list.map((b) =>
            b.type === "DOCUMENT"
              ? { ...b, content: detail.content, version: result.block_version }
              : b
          );
        });
      }
      // The restore created a new snapshot — refresh the list.
      queryClient.invalidateQueries({ queryKey: historyKeys.list(pageId) });
      setConfirmRestore(false);
      onClose();
    } catch (err) {
      controller?.resume();
      setRestoreError(
        err instanceof Error ? err.message : "Failed to restore version."
      );
    } finally {
      setIsRestoring(false);
    }
  }, [
    effectiveVersion,
    detail,
    coordination,
    pageId,
    restore,
    queryClient,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Page history"
    >
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" />

      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-3">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <History className="h-4 w-4" />
            <h2 className="text-base font-semibold">Page history</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Version list */}
          <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-[var(--border-default)]">
            {isLoading && (
              <div className="p-4 text-sm text-[var(--text-tertiary)]">
                Loading history…
              </div>
            )}
            {isError && (
              <div className="p-4 text-sm text-[var(--danger)]">
                Failed to load history.
              </div>
            )}
            {versions && versions.length === 0 && (
              <div className="p-4 text-sm text-[var(--text-tertiary)]">
                No saved versions yet. Edits will appear here.
              </div>
            )}
            <ul>
              {versions?.map((v) => {
                const isSelected = v.version === effectiveVersion;
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => {
                        setSelectedVersion(v.version);
                        setConfirmRestore(false);
                        setRestoreError(null);
                      }}
                      className={`flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-[var(--bg-hover)]"
                          : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <span className="font-medium text-[var(--text-primary)]">
                        {changeTypeLabel(v)}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {relativeTime(v.created_at)} · {v.word_count} words
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Preview + diff */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {effectiveVersion === null ? (
              <div className="p-6 text-sm text-[var(--text-tertiary)]">
                Select a version to preview.
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    Version {effectiveVersion}
                  </h3>
                  <div className="whitespace-pre-wrap rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
                    {detail?.plain_text?.trim()
                      ? detail.plain_text
                      : "(empty)"}
                  </div>
                </div>

                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    Changes vs current
                  </h3>
                  <div className="rounded-md border border-[var(--border-default)] p-3 text-sm leading-relaxed">
                    {diff && diff.changes.length > 0 ? (
                      <p className="flex flex-wrap gap-x-1">
                        {diff.changes.map((c, i) => (
                          <span
                            key={i}
                            className={
                              c.type === "add"
                                ? "rounded bg-green-500/15 text-green-600 dark:text-green-400"
                                : c.type === "remove"
                                  ? "rounded bg-red-500/15 text-red-600 line-through dark:text-red-400"
                                  : "text-[var(--text-secondary)]"
                            }
                          >
                            {c.value}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">
                        No differences from the current content.
                      </span>
                    )}
                  </div>
                  {diff && (
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      +{diff.additions} added · −{diff.deletions} removed
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer / restore action */}
        <div className="border-t border-[var(--border-default)] px-5 py-3">
          {restoreError && (
            <p className="mb-2 text-sm text-[var(--danger)]">{restoreError}</p>
          )}
          {confirmRestore ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--text-secondary)]">
                Restore to version {effectiveVersion}? This overwrites the
                current content.
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmRestore(false)}
                  disabled={isRestoring}
                  className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isRestoring ? "Restoring…" : "Restore"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRestore(true)}
              disabled={effectiveVersion === null || !detail}
              className="flex items-center gap-2 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restore this version
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
