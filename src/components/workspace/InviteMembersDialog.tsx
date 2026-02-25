"use client";

import { useEffect, useRef, useCallback } from "react";

interface InviteMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export function InviteMembersDialog({
  isOpen,
  onClose,
  workspaceName,
}: InviteMembersDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when dialog opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
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

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl p-6">
        {/* Team icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-[var(--text-primary)] text-center mb-4">
          Invite members to {workspaceName}
        </h2>

        {/* Disabled email input + role selector */}
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            placeholder="name@example.com"
            disabled
            aria-disabled="true"
            aria-describedby="invite-coming-soon"
            className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-tertiary)] placeholder:text-[var(--text-tertiary)] opacity-60 cursor-not-allowed"
          />
          <select
            disabled
            aria-disabled="true"
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-tertiary)] opacity-60 cursor-not-allowed"
          >
            <option>Member</option>
          </select>
        </div>

        {/* Disabled invite button */}
        <button
          disabled
          className="w-full rounded-md bg-[var(--accent-primary)] text-white text-sm font-medium py-2 opacity-50 cursor-not-allowed mb-4"
        >
          Invite
        </button>

        {/* Coming soon message */}
        <p
          id="invite-coming-soon"
          className="text-sm text-[var(--text-secondary)] text-center mb-4"
        >
          Team invitations are coming soon. You&apos;ll be able to invite
          collaborators by email.
        </p>

        {/* Close button */}
        <div className="flex justify-end">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
