"use client";

import { useState, useCallback } from "react";
import { Trash2, Star, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useDeletePage } from "@/hooks/usePages";
import { useToggleFavorite } from "@/hooks/useFavorites";
import { useRouter, usePathname } from "next/navigation";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  /** Map of pageId → title for display in confirmation modal */
  pageTitles: Map<string, string>;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedIds,
  pageTitles,
  onClearSelection,
}: BulkActionBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletePage = useDeletePage();
  const toggleFavorite = useToggleFavorite();
  const router = useRouter();
  const pathname = usePathname();

  const count = selectedIds.size;

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    let navigateAway = false;

    for (const id of ids) {
      try {
        await deletePage.mutateAsync(id);
        if (pathname === `/pages/${id}`) {
          navigateAway = true;
        }
      } catch {
        // Individual failures logged by mutation — continue
      }
    }

    if (navigateAway) {
      router.push("/home");
    }

    setIsDeleting(false);
    setShowDeleteConfirm(false);
    onClearSelection();
  }, [selectedIds, deletePage, pathname, router, onClearSelection]);

  const handleBulkFavorite = useCallback(() => {
    for (const id of selectedIds) {
      toggleFavorite.mutate({ pageId: id, isFavorite: true });
    }
    onClearSelection();
  }, [selectedIds, toggleFavorite, onClearSelection]);

  if (count === 0) return null;

  return (
    <>
      <div className="flex-shrink-0 border-t border-[var(--border-default)] bg-[var(--sidebar-bg)] px-2 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-[var(--sidebar-text)]">
            {count} page{count !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={onClearSelection}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors"
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5 text-[var(--sidebar-text-secondary)]" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--danger)]/10 text-[var(--danger)] transition-colors"
            title={`Delete ${count} page${count !== 1 ? "s" : ""}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
          <button
            onClick={handleBulkFavorite}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text)] transition-colors"
            title={`Favorite ${count} page${count !== 1 ? "s" : ""}`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Favorite</span>
          </button>
        </div>
      </div>

      {/* Bulk delete confirmation modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirm(false)}
          title={`Delete ${count} page${count !== 1 ? "s" : ""}?`}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                loading={isDeleting}
              >
                Delete {count} page{count !== 1 ? "s" : ""}
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            The following pages will be permanently deleted:
          </p>
          <ul className="text-sm space-y-0.5 max-h-40 overflow-y-auto">
            {Array.from(selectedIds).map((id) => (
              <li key={id} className="text-[var(--text-primary)] font-medium truncate">
                &bull; {pageTitles.get(id) || "Untitled"}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
