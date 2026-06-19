"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary for the App Router.
 *
 * Renders when an error is thrown in the root layout or any segment that has
 * no nearer `error.tsx`. It replaces the root layout, so it MUST render its
 * own <html> and <body>. Without this file a render throw at the top of the
 * tree produces a fully blank white screen with no recovery path.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#0b0b0c",
          color: "#e5e7eb",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
            The application hit an unexpected error. Your data is safe — try
            reloading this view.
          </p>
          {error?.digest && (
            <p style={{ marginTop: 8, fontSize: 12, opacity: 0.5 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              background: "#2563eb",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
