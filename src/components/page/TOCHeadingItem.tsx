"use client";

import { useRef, useEffect } from "react";
import type { TOCHeading } from "@/hooks/useTableOfContents";

interface TOCHeadingItemProps {
  heading: TOCHeading;
  isActive: boolean;
  isFocused: boolean;
  onClick: () => void;
}

const INDENT: Record<number, string> = {
  1: "pl-2",
  2: "pl-6",
  3: "pl-10",
};

const FONT: Record<number, string> = {
  1: "text-sm font-semibold",
  2: "text-[13px]",
  3: "text-xs text-[var(--text-tertiary)]",
};

export function TOCHeadingItem({
  heading,
  isActive,
  isFocused,
  onClick,
}: TOCHeadingItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  // Auto-scroll active heading into view within the panel
  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);

  return (
    <button
      ref={ref}
      type="button"
      role="link"
      aria-current={isActive ? "true" : undefined}
      onClick={onClick}
      tabIndex={isFocused ? 0 : -1}
      className={`
        w-full text-left rounded py-1 cursor-pointer truncate
        transition-colors duration-100
        ${INDENT[heading.level] ?? "pl-2"}
        ${FONT[heading.level] ?? "text-[13px]"}
        ${
          isActive
            ? "text-[var(--text-primary)] font-semibold border-l-2 border-[var(--accent-primary)] bg-[var(--bg-hover)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        }
        focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] focus-visible:outline-offset-[-2px]
      `}
    >
      <span className="block truncate pr-2">{heading.text}</span>
    </button>
  );
}
