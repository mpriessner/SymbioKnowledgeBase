"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTeamspaces } from "@/hooks/useTeamspaces";

interface ShareModalProps {
  pageId: string;
  currentTeamspaceId: string | null;
  onClose: () => void;
}

export function ShareModal({
  pageId,
  currentTeamspaceId,
  onClose,
}: ShareModalProps) {
  const { data: teamspaces } = useTeamspaces();

  const [visibility, setVisibility] = useState<"private" | "team">(
    currentTeamspaceId ? "team" : "private"
  );
  const [selectedTeamspace, setSelectedTeamspace] = useState(
    currentTeamspaceId || ""
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Share link state
  const [shareLink, setShareLink] = useState<{
    token: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    const teamspaceId = visibility === "private" ? null : selectedTeamspace;
    if (visibility === "team" && !selectedTeamspace) return;

    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`/api/pages/${pageId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamspaceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveMessage(err.error?.message || "Failed to update visibility");
        return;
      }
      setSaveMessage("Page visibility updated");
      setTimeout(onClose, 800);
    } catch {
      setSaveMessage("Network error");
    } finally {
      setSaving(false);
    }
  }, [pageId, visibility, selectedTeamspace, onClose]);

  const handleGenerateLink = useCallback(async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/share-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      if (!res.ok) return;
      const json = await res.json();
      setShareLink(json.data);
    } catch {
      // ignore
    } finally {
      setGeneratingLink(false);
    }
  }, [pageId]);

  const handleCopy = useCallback(() => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Dialog */}
      <div
        className="relative bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Share Page
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Visibility Section */}
        <div className="space-y-3 mb-6">
          <label className="text-sm font-medium text-[var(--text-primary)]">
            Visibility
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">
                Private (only me)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="team"
                checked={visibility === "team"}
                onChange={() => setVisibility("team")}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">
                Share with Team
              </span>
            </label>
          </div>

          {visibility === "team" && (
            <select
              value={selectedTeamspace}
              onChange={(e) => setSelectedTeamspace(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
            >
              <option value="">Select a team</option>
              {teamspaces?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.icon} {team.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (visibility === "team" && !selectedTeamspace)}
            className="px-4 py-2 text-sm font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {saveMessage && (
            <p className="text-xs text-[var(--text-tertiary)]">{saveMessage}</p>
          )}
        </div>

        {/* Public Link Section */}
        <div className="border-t border-[var(--border-default)] pt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Public Link
          </h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Anyone with the link can view this page (read-only)
          </p>

          {!shareLink ? (
            <button
              onClick={handleGenerateLink}
              disabled={generatingLink}
              className="mt-3 px-4 py-2 text-sm font-medium rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 transition-colors"
            >
              {generatingLink ? "Generating..." : "Generate Public Link"}
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareLink.url}
                  readOnly
                  className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-sm font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Expires on{" "}
                {new Date(shareLink.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
