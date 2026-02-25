"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareDialog";

interface ShareButtonProps {
  pageId: string;
  pageTitle: string;
  currentUserId?: string;
  generalAccess?: "INVITED_ONLY" | "ANYONE_WITH_LINK";
}

export function ShareButton({
  pageId,
  pageTitle,
  currentUserId,
  generalAccess = "INVITED_ONLY",
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded px-3 py-1 text-sm font-medium border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-strong)] transition-colors"
      >
        Share
      </button>
      {isOpen && (
        <ShareDialog
          pageId={pageId}
          pageTitle={pageTitle}
          onClose={() => setIsOpen(false)}
          currentUserId={currentUserId}
          generalAccess={generalAccess}
        />
      )}
    </div>
  );
}
