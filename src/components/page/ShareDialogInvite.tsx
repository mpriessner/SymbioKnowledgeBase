"use client";

import { useState, useCallback } from "react";
import { useInviteToPage } from "@/hooks/usePageShares";

interface ShareDialogInviteProps {
  pageId: string;
}

export function ShareDialogInvite({ pageId }: ShareDialogInviteProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invite = useInviteToPage(pageId);

  const handleInvite = useCallback(() => {
    setError(null);

    // Basic email validation
    const trimmed = email.trim();
    if (!trimmed) return;

    const emails = trimmed.split(",").map((e) => e.trim()).filter(Boolean);
    const invalidEmail = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalidEmail) {
      setError(`Invalid email: ${invalidEmail}`);
      return;
    }

    // Invite each email sequentially (first one for now)
    invite.mutate(
      { email: emails[0], permission: "CAN_VIEW" },
      {
        onSuccess: () => {
          setEmail("");
          setError(null);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  }, [email, invite]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInvite();
      }
    },
    [handleInvite]
  );

  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Email or group, separated by commas"
          className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
        />
        <button
          onClick={handleInvite}
          disabled={!email.trim() || invite.isPending}
          className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Invite
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
