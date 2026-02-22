"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCreateTeamspace } from "@/hooks/useTeamspaces";

interface CreateTeamModalProps {
  onClose: () => void;
}

export function CreateTeamModal({ onClose }: CreateTeamModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState("");
  const { mutate: createTeam, isPending } = useCreateTeamspace();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");

    createTeam(
      { name: name.trim(), icon: icon || null },
      {
        onSuccess: () => onClose(),
        onError: (err: Error) => setError(err.message || "Failed to create team"),
      }
    );
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Create Team
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Team Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Research Team"
              required
              maxLength={100}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Icon (emoji)
            </label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🚀"
              maxLength={2}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="px-4 py-2 text-sm font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? "Creating..." : "Create Team"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
