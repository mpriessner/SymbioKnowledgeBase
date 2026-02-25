import {
  differenceInDays,
  addDays,
  subDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from "date-fns";
import type { RowProperties } from "@/types/database";

export type ZoomLevel = "day" | "week" | "month";

export interface TimeAxisHeader {
  label: string;
  date: Date;
  width: number; // pixels
}

/**
 * Get pixels per day for each zoom level.
 */
export function getPixelsPerDay(zoom: ZoomLevel): number {
  switch (zoom) {
    case "day":
      return 40;
    case "week":
      return 12; // ~84px per week
    case "month":
      return 4; // ~120px per month
  }
}

/**
 * Calculate the visible date range for the timeline.
 * Adds 7-day padding before earliest start and after latest end.
 */
export function getTimelineRange<T extends { properties: RowProperties }>(
  rows: T[],
  startColumnId: string,
  endColumnId: string
): { start: Date; end: Date } {
  const today = new Date();
  let earliest = today;
  let latest = today;

  for (const row of rows) {
    const startProp = row.properties[startColumnId];
    const endProp = row.properties[endColumnId];

    if (startProp?.type === "DATE" && startProp.value) {
      const d = new Date(startProp.value as string);
      if (d < earliest) earliest = d;
      if (d > latest) latest = d;
    }
    if (endProp?.type === "DATE" && endProp.value) {
      const d = new Date(endProp.value as string);
      if (d < earliest) earliest = d;
      if (d > latest) latest = d;
    }
  }

  return {
    start: subDays(startOfDay(earliest), 7),
    end: addDays(startOfDay(latest), 7),
  };
}

/**
 * Convert a date to a pixel position relative to timeline start.
 */
export function dateToPixel(
  date: Date,
  timelineStart: Date,
  pixelsPerDay: number
): number {
  const days = differenceInDays(startOfDay(date), startOfDay(timelineStart));
  return days * pixelsPerDay;
}

/**
 * Convert a pixel position back to a date.
 */
export function pixelToDate(
  pixel: number,
  timelineStart: Date,
  pixelsPerDay: number
): Date {
  const days = Math.round(pixel / pixelsPerDay);
  return addDays(startOfDay(timelineStart), days);
}

/**
 * Snap a date to the start of day (midnight).
 */
export function snapToDay(date: Date): Date {
  return startOfDay(date);
}

/**
 * Generate time axis headers for the given date range and zoom level.
 */
export function generateTimeAxisHeaders(
  start: Date,
  end: Date,
  zoom: ZoomLevel
): TimeAxisHeader[] {
  const ppd = getPixelsPerDay(zoom);

  switch (zoom) {
    case "day": {
      const days = eachDayOfInterval({ start, end });
      return days.map((d) => ({
        label: format(d, "d"),
        date: d,
        width: ppd,
      }));
    }
    case "week": {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      return weeks.map((w, i) => {
        const nextWeek = i < weeks.length - 1 ? weeks[i + 1] : addDays(w, 7);
        const dayCount = differenceInDays(nextWeek, w);
        return {
          label: format(w, "MMM d"),
          date: w,
          width: dayCount * ppd,
        };
      });
    }
    case "month": {
      const months = eachMonthOfInterval({ start, end });
      return months.map((m) => {
        const monthEnd = endOfMonth(m);
        const dayCount = differenceInDays(monthEnd, m) + 1;
        return {
          label: format(m, "MMM yyyy"),
          date: m,
          width: dayCount * ppd,
        };
      });
    }
  }
}

/**
 * Generate month group headers (for day/week zoom — shows "February 2026" etc.)
 */
export function generateMonthGroupHeaders(
  start: Date,
  end: Date,
  pixelsPerDay: number
): { label: string; width: number }[] {
  const months = eachMonthOfInterval({ start, end });
  return months.map((m) => {
    const mEnd = endOfMonth(m);
    const dayCount = differenceInDays(mEnd, m) + 1;
    return {
      label: format(m, "MMMM yyyy"),
      width: dayCount * pixelsPerDay,
    };
  });
}
