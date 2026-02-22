"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";

interface HighlightedTextProps {
  /** HTML string with <mark> tags from ts_headline */
  html: string;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  "aria-label"?: string;
}

/**
 * Renders HTML with highlighted keywords (<mark> tags).
 *
 * Sanitizes the HTML using DOMPurify to prevent XSS attacks.
 * Only allows <mark> tags — all other HTML is stripped.
 */
export function HighlightedText({
  html,
  className = "",
  "aria-label": ariaLabel,
}: HighlightedTextProps) {
  const sanitized = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["mark"],
      ALLOWED_ATTR: [],
    });
  }, [html]);

  return (
    <span
      className={`${className} [&_mark]:bg-yellow-200 [&_mark]:text-[var(--text-primary)] [&_mark]:px-0.5 [&_mark]:rounded-sm dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      aria-label={ariaLabel}
    />
  );
}
