import Link from "next/link";

/**
 * Workspace-scoped 404.
 *
 * Renders when a workspace route doesn't match or a page calls `notFound()`
 * (e.g. navigating to a deleted/soft-deleted page). The shared workspace
 * layout stays mounted, so the user keeps the sidebar and gets a clear path
 * back instead of a bare framework 404.
 */
export default function WorkspaceNotFound() {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 text-center">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This page may have been moved or deleted. Pick another page from the
          sidebar, or head back home.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-primary-hover)]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
