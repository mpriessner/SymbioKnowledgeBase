"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ShareDialogInvite } from "./ShareDialogInvite";
import { ShareDialogMemberList } from "./ShareDialogMemberList";
import { ShareDialogGeneralAccess } from "./ShareDialogGeneralAccess";

interface ShareDialogProps {
  pageId: string;
  pageTitle: string;
  onClose: () => void;
  currentUserId?: string;
  generalAccess: "INVITED_ONLY" | "ANYONE_WITH_LINK";
}

export function ShareDialog({
  pageId,
  pageTitle,
  onClose,
  currentUserId,
  generalAccess,
}: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<"share" | "publish">("share");
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid immediate close from the button click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/pages/${pageId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pageId]);

  return (
    <div
      ref={dialogRef}
      className="absolute right-0 top-10 z-50 w-[440px] rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg"
    >
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-default)] px-4 pt-3">
        <button
          className={`pb-2 px-1 mr-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "share"
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("share")}
        >
          Share
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "publish"
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          onClick={() => setActiveTab("publish")}
        >
          Publish
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "share" && (
        <div className="p-4">
          <ShareDialogInvite pageId={pageId} />
          <ShareDialogMemberList
            pageId={pageId}
            currentUserId={currentUserId}
          />
          <ShareDialogGeneralAccess
            pageId={pageId}
            currentAccess={generalAccess}
          />

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-default)]">
            <button className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              Learn about sharing
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.124a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.31 8.688"
                />
              </svg>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "publish" && (
        <div className="p-4 text-sm text-[var(--text-secondary)]">
          Publishing is coming soon.
        </div>
      )}
    </div>
  );
}
