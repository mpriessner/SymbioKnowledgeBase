"use client";

import type { SaveStatus } from "@/types/editor";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
}

const statusConfig: Record<
  SaveStatus,
  { label: string; className: string }
> = {
  idle: {
    label: "",
    className: "text-transparent",
  },
  saving: {
    label: "Saving...",
    className: "text-[var(--text-tertiary)]",
  },
  saved: {
    label: "Saved",
    className: "text-green-600 dark:text-green-400",
  },
  error: {
    label: "Error saving",
    className: "text-red-600 dark:text-red-400",
  },
};

export function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  const config = statusConfig[status];

  if (status === "idle") return null;

  return (
    <span
      className={`text-sm font-medium transition-colors duration-200 ${config.className}`}
      data-testid="save-status"
      aria-live="polite"
    >
      {config.label}
    </span>
  );
}
