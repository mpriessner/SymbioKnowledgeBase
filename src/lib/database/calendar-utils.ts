import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay as dateFnsIsSameDay,
  isSameMonth,
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import type { RowProperties } from "@/types/database";

/**
 * Get all days to display in a month grid (including overflow from prev/next months).
 * Returns 35 or 42 days to fill a complete 5- or 6-row grid.
 */
export function getMonthGridDays(year: number, month: number): Date[] {
  const date = new Date(year, month, 1);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

/**
 * Get all 7 days of the week containing the given date (Mon-Sun).
 */
export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

/**
 * Map database rows to date keys ("2026-02-15" → rows on that day).
 * Rows without a date go into the "no-date" key.
 */
export function mapRowsToDays<T extends { id: string; properties: RowProperties }>(
  rows: T[],
  dateColumnId: string
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const row of rows) {
    const prop = row.properties[dateColumnId];
    if (prop?.type === "DATE" && prop.value) {
      const dateStr = typeof prop.value === "string" ? prop.value : "";
      const key = dateStr.slice(0, 10); // "YYYY-MM-DD"
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
        continue;
      }
    }
    // No date value
    if (!map.has("no-date")) map.set("no-date", []);
    map.get("no-date")!.push(row);
  }

  return map;
}

/**
 * Format date to a key string: "YYYY-MM-DD".
 */
export function dateToKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Check if two dates are the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return dateFnsIsSameDay(a, b);
}

/**
 * Check if a date is within the given reference month.
 */
export function isCurrentMonth(date: Date, referenceDate: Date): boolean {
  return isSameMonth(date, referenceDate);
}

/**
 * Navigate months: +1 or -1.
 */
export function navigateMonth(date: Date, direction: 1 | -1): Date {
  return direction === 1 ? addMonths(date, 1) : subMonths(date, 1);
}

/**
 * Navigate weeks: +1 or -1.
 */
export function navigateWeek(date: Date, direction: 1 | -1): Date {
  return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1);
}

/**
 * Format for display.
 */
export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy");
}

export function formatWeekdayShort(date: Date): string {
  return format(date, "EEE");
}

export function formatDayNumber(date: Date): string {
  return format(date, "d");
}

export function formatWeekdayDate(date: Date): string {
  return format(date, "EEE d");
}
