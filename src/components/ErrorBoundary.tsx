"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Custom fallback. Receives the caught error and a reset callback that
   * clears the error state and re-attempts rendering the children.
   * If omitted, a default fallback is shown.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /**
   * Optional callback invoked when an error is caught — useful for logging
   * or surfacing the error to a monitoring service.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Generic React error boundary.
 *
 * Stops a render-time throw in any descendant from white-screening the whole
 * subtree it wraps. Without it, an exception in (e.g.) the editor or graph
 * canvas unmounts the entire React tree and the user sees a blank page with
 * no recovery path. With it, the rest of the app keeps working and the user
 * gets a "try again" affordance scoped to the broken region.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep a console trail even when no external onError handler is wired.
    console.error("ErrorBoundary caught an error:", error, info);
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return <DefaultErrorFallback error={error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[300px] w-full items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 text-center">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This part of the page failed to load. The rest of the app is still
          working.
        </p>
        {error?.message && (
          <p className="mt-2 break-words text-xs text-[var(--text-tertiary)]">
            {error.message}
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

interface EditorErrorFallbackProps {
  error: Error;
  reset: () => void;
  /**
   * Best-effort accessor for the current in-memory document content, so the
   * user can recover unsaved work even when the editor crashed. May return
   * null if no content is available.
   */
  getContent?: () => unknown;
}

/**
 * Editor-specific fallback. The editor holds the user's unsaved work in
 * memory; a crash here must NOT silently lose it. This fallback surfaces a
 * copy-to-clipboard escape hatch so the user can rescue their content before
 * retrying, and a "try again" that remounts the editor.
 */
export function EditorErrorFallback({
  error,
  reset,
  getContent,
}: EditorErrorFallbackProps) {
  const handleCopy = async () => {
    try {
      const content = getContent?.();
      const text =
        typeof content === "string"
          ? content
          : JSON.stringify(content ?? {}, null, 2);
      await navigator.clipboard.writeText(text);
      window.alert("Your unsaved content was copied to the clipboard.");
    } catch {
      window.alert(
        "Could not access the clipboard. Try selecting and copying the text manually."
      );
    }
  };

  return (
    <div className="flex min-h-[300px] w-full items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-red-500/40 bg-red-50 p-6 text-center dark:bg-red-900/20">
        <h2 className="text-base font-semibold text-red-800 dark:text-red-200">
          The editor crashed
        </h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          To avoid losing your work, copy your current content before retrying.
        </p>
        {error?.message && (
          <p className="mt-2 break-words text-xs text-red-700/70 dark:text-red-300/70">
            {error.message}
          </p>
        )}
        <div className="mt-4 flex items-center justify-center gap-2">
          {getContent && (
            <button
              onClick={handleCopy}
              className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/40"
            >
              Copy unsaved content
            </button>
          )}
          <button
            onClick={reset}
            className="rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-primary-hover)]"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
