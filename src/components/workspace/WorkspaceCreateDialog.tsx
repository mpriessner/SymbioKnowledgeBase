"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { WorkspaceAvatar } from "./WorkspaceAvatar";

interface WorkspaceCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  isCreating: boolean;
}

export function WorkspaceCreateDialog({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: WorkspaceCreateDialogProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      // Small delay to ensure the dialog is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 50) return;
      onCreate(trimmed);
    },
    [name, onCreate]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  const isValid = name.trim().length >= 2;
  const isTooLong = name.trim().length > 50;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Create a workspace
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Live avatar preview */}
          <div className="flex items-center gap-3 mb-4">
            <WorkspaceAvatar name={name || "W"} size="lg" />
            <div className="flex-1">
              <label
                htmlFor="workspace-name"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Workspace name
              </label>
              <input
                ref={inputRef}
                id="workspace-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                maxLength={60}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                disabled={isCreating}
              />
              {isTooLong && (
                <p className="text-xs text-[var(--danger)] mt-1">
                  Name must be 50 characters or less
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isTooLong || isCreating}
              className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
