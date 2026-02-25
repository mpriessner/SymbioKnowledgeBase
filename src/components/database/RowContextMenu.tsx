"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface RowContextMenuProps {
  rowId: string;
  rowTitle: string;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (rowId: string) => void;
  isDeleting?: boolean;
}

export function RowContextMenu({
  rowId,
  rowTitle,
  position,
  onClose,
  onDelete,
  isDeleting,
}: RowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleConfirmDelete = useCallback(() => {
    onDelete(rowId);
    setShowDeleteConfirm(false);
    onClose();
  }, [rowId, onDelete, onClose]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const adjustedX = Math.min(Math.max(8, position.x), vw - 200);
  const adjustedY = Math.min(Math.max(8, position.y), vh - 60);

  if (showDeleteConfirm) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Delete row"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} loading={isDeleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[var(--text-secondary)]">
          Delete <span className="font-medium text-[var(--text-primary)]">&quot;{rowTitle}&quot;</span>?
          This cannot be undone.
        </p>
      </Modal>
    );
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[160px] rounded-lg border border-[var(--border-default)]
                 bg-[var(--bg-primary)] py-1 shadow-lg shadow-black/20"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors
          text-[var(--danger)] hover:bg-[var(--danger)]/10"
        onClick={() => setShowDeleteConfirm(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span>Delete</span>
      </button>
    </div>
  );
}
