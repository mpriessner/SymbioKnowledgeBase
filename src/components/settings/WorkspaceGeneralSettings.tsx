"use client";

import { useState, useCallback } from "react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface WorkspaceGeneralSettingsProps {
  /** Also render the read-only workspace id and created date. */
  showMeta?: boolean;
}

function formatCreatedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Workspace name control shared by the Settings modal and the Settings →
 * General page. Owners/admins can rename; other members see a read-only field.
 * On save the change is applied optimistically and the workspaces list query is
 * refetched so the sidebar dropdown updates without a reload.
 */
export function WorkspaceGeneralSettings({
  showMeta = false,
}: WorkspaceGeneralSettingsProps) {
  const { workspaces, isLoading, renameWorkspace, isRenaming } = useWorkspaces();
  const { toasts, addToast, removeToast } = useToast();

  const activeWorkspace = workspaces.find((w) => w.isCurrent);
  const canEdit =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  const [name, setName] = useState("");
  const [syncedName, setSyncedName] = useState<string | null>(null);

  // Keep the input in sync with the loaded / optimistic workspace name, but
  // don't clobber what the user is mid-typing. Adjust-during-render instead
  // of an effect so the sync doesn't cascade an extra render pass.
  if (activeWorkspace && !isRenaming && activeWorkspace.name !== syncedName) {
    setSyncedName(activeWorkspace.name);
    setName(activeWorkspace.name);
  }

  const commit = useCallback(async () => {
    if (!activeWorkspace || !canEdit) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === activeWorkspace.name) {
      setName(activeWorkspace.name);
      return;
    }
    if (trimmed.length > 100) {
      addToast("Workspace name must be 100 characters or less", "error");
      setName(activeWorkspace.name);
      return;
    }
    try {
      await renameWorkspace(trimmed);
      addToast("Workspace name updated", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to rename workspace",
        "error"
      );
      setName(activeWorkspace.name);
    }
  }, [activeWorkspace, canEdit, name, renameWorkspace, addToast]);

  return (
    <>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="workspace-name"
            className="text-sm font-medium text-[var(--text-primary)] block mb-2"
          >
            Workspace Name
          </label>
          <div className="max-w-md">
            <input
              id="workspace-name"
              type="text"
              value={name}
              disabled={!canEdit || isLoading || isRenaming}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  if (activeWorkspace) setName(activeWorkspace.name);
                  e.currentTarget.blur();
                }
              }}
              maxLength={100}
              className={`w-full px-3 py-2 rounded-md border border-[var(--border-default)]
                bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm
                focus:outline-none focus:border-[var(--accent-primary)]
                ${
                  !canEdit || isLoading || isRenaming
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
            />
            {!canEdit ? (
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Only workspace owners and admins can rename the workspace.
              </p>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Press Enter or click away to save.
              </p>
            )}
          </div>
        </div>

        {showMeta && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                Workspace ID
              </label>
              <p className="text-sm text-[var(--text-secondary)] font-mono break-all max-w-md">
                {activeWorkspace?.id ?? "—"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                Created
              </label>
              <p className="text-sm text-[var(--text-secondary)] max-w-md">
                {formatCreatedAt(activeWorkspace?.createdAt)}
              </p>
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
