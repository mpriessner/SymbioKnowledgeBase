"use client";

import type { ContentTypeFilter } from "@/types/search";

interface ContentTypeTogglesProps {
  selectedTypes: ContentTypeFilter[];
  onToggle: (type: ContentTypeFilter) => void;
}

const CONTENT_TYPES: {
  value: ContentTypeFilter;
  label: string;
  icon: string;
}[] = [
  { value: "code", label: "Code", icon: "</>" },
  { value: "images", label: "Images", icon: "\u{1F5BC}\u{FE0F}" },
  { value: "links", label: "Links", icon: "\u{1F517}" },
];

/**
 * Toggle buttons for content type filters.
 */
export function ContentTypeToggles({
  selectedTypes,
  onToggle,
}: ContentTypeTogglesProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-secondary)]">Has:</span>
      {CONTENT_TYPES.map((type) => {
        const isSelected = selectedTypes.includes(type.value);
        return (
          <button
            key={type.value}
            onClick={() => onToggle(type.value)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
              ${
                isSelected
                  ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-default)] hover:border-[var(--accent-primary)]"
              }
            `}
            aria-pressed={isSelected}
          >
            <span className="mr-1">{type.icon}</span>
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
