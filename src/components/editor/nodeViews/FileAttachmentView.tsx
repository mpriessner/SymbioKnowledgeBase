"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

/** Format a byte count as a compact human-readable string. */
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = unit === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/**
 * Compact card for a non-image file attachment: file-type glyph, filename,
 * size, and a download link that hits the tenant-scoped serving route.
 */
export function FileAttachmentView({ node }: NodeViewProps) {
  const attachmentId = node.attrs.attachmentId as string;
  const name = (node.attrs.name as string) || "Untitled file";
  const size = node.attrs.size as number;

  const href = attachmentId ? `/api/attachments/${attachmentId}` : "#";

  return (
    <NodeViewWrapper data-testid="file-attachment-block" contentEditable={false}>
      <a
        href={href}
        download={name}
        className="my-3 flex items-center gap-3 rounded-lg border border-[var(--border-default)] px-4 py-3 no-underline transition-colors hover:bg-[var(--bg-secondary)]"
        data-testid="file-attachment-link"
      >
        {/* File-type glyph */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8.5L13.5 3z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 3v5h5"
            />
          </svg>
        </span>

        {/* Name + size */}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
            {name}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {formatBytes(size)}
          </span>
        </span>

        {/* Download glyph */}
        <span
          className="shrink-0 text-[var(--text-tertiary)]"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
            />
          </svg>
        </span>
      </a>
    </NodeViewWrapper>
  );
}
