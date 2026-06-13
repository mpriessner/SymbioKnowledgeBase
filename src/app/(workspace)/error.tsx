"use client";

import { useEffect } from "react";

/**
 * Segment-level error boundary for the workspace.
 *
 * Catches render throws within any workspace route (pages, graph, settings,
 * etc.) that aren't handled by a nearer boundary. The shared layout (sidebar,
 * breadcrumbs) stays mounted, so the user keeps navigation and can recover the
 * broken view instead of seeing a blank page.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 text-center">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          This view failed to load
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Something went wrong rendering this part of your workspace. Your
          notes are unaffected — you can retry or use the sidebar to navigate
          elsewhere.
        </p>
        {error?.digest && (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-primary-hover)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
