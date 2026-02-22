"use client";

import { X } from "lucide-react";
import type { SearchFilters } from "@/types/search";

interface FilterChipsProps {
  filters: SearchFilters;
  onRemoveFilter: (filterKey: keyof SearchFilters) => void;
  onClearAll: () => void;
}

/**
 * Displays active search filters as removable chips.
 */
export function FilterChips({
  filters,
  onRemoveFilter,
  onClearAll,
}: FilterChipsProps) {
  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    (filters.contentType && filters.contentType.length > 0);

  if (!hasActiveFilters) return null;

  const chipClass =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-default)]";

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--border-default)]">
      {/* Date range chip */}
      {(filters.dateFrom || filters.dateTo) && (
        <button
          className={chipClass}
          onClick={() => {
            onRemoveFilter("dateFrom");
            onRemoveFilter("dateTo");
          }}
          aria-label="Remove date filter"
        >
          <span>
            {filters.dateFrom && filters.dateTo
              ? `${filters.dateFrom} to ${filters.dateTo}`
              : filters.dateFrom
                ? `After ${filters.dateFrom}`
                : `Before ${filters.dateTo}`}
          </span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Content type chips */}
      {filters.contentType?.map((type) => (
        <button
          key={type}
          className={chipClass}
          onClick={() => {
            const newTypes = filters.contentType!.filter((t) => t !== type);
            if (newTypes.length > 0) {
              // Parent will handle updating with remaining types
            }
            onRemoveFilter("contentType");
          }}
          aria-label={`Remove ${type} filter`}
        >
          <span>Has: {type}</span>
          <X className="h-3 w-3" />
        </button>
      ))}

      {/* Clear all button */}
      <button
        className="ml-auto text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  );
}
