"use client";

import type { PropertyValue } from "@/types/database";

interface PropertyCellProps {
  value: PropertyValue | undefined;
}

export function PropertyCell({ value }: PropertyCellProps) {
  if (!value) {
    return <span className="text-[var(--text-secondary)]">-</span>;
  }

  switch (value.type) {
    case "TITLE":
    case "TEXT":
      return <span>{value.value}</span>;

    case "NUMBER":
      return <span className="tabular-nums text-right">{value.value}</span>;

    case "SELECT":
      return (
        <span className="inline-block rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-xs font-medium">
          {value.value}
        </span>
      );

    case "MULTI_SELECT":
      return (
        <div className="flex flex-wrap gap-1">
          {value.value.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      );

    case "DATE":
      return (
        <span>
          {new Date(value.value).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      );

    case "CHECKBOX":
      return (
        <span className="text-lg">{value.value ? "\u2705" : "\u2B1C"}</span>
      );

    case "URL":
      try {
        return (
          <a
            href={value.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-primary)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {new URL(value.value).hostname}
          </a>
        );
      } catch {
        return <span className="text-[var(--text-secondary)]">{value.value}</span>;
      }

    default:
      return <span>-</span>;
  }
}
