"use client";

import { Calendar } from "lucide-react";

interface DateRangePickerProps {
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange: (date: string | undefined) => void;
  onDateToChange: (date: string | undefined) => void;
}

/**
 * Date range picker for search filters.
 * Uses native HTML date inputs for simplicity.
 */
export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-3">
      <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />

      <div className="flex items-center gap-2">
        <label
          htmlFor="date-from"
          className="text-xs text-[var(--text-secondary)]"
        >
          From:
        </label>
        <input
          id="date-from"
          type="date"
          value={dateFrom || ""}
          onChange={(e) => onDateFromChange(e.target.value || undefined)}
          className="px-2 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="date-to"
          className="text-xs text-[var(--text-secondary)]"
        >
          To:
        </label>
        <input
          id="date-to"
          type="date"
          value={dateTo || ""}
          onChange={(e) => onDateToChange(e.target.value || undefined)}
          className="px-2 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
        />
      </div>
    </div>
  );
}
