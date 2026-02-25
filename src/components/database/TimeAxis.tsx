"use client";

import type { TimeAxisHeader } from "@/lib/database/timeline-utils";

interface TimeAxisProps {
  headers: TimeAxisHeader[];
  monthHeaders?: { label: string; width: number }[];
  todayPosition: number | null;
}

export function TimeAxis({
  headers,
  monthHeaders,
  todayPosition,
}: TimeAxisProps) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-default)]">
      {/* Month group headers */}
      {monthHeaders && monthHeaders.length > 0 && (
        <div className="flex border-b border-[var(--border-default)]">
          {monthHeaders.map((mh, i) => (
            <div
              key={i}
              className="text-[10px] font-semibold text-[var(--text-secondary)] px-2 py-1
                border-r border-[var(--border-default)] truncate"
              style={{ width: mh.width, minWidth: mh.width }}
            >
              {mh.label}
            </div>
          ))}
        </div>
      )}

      {/* Day/week/month headers */}
      <div className="relative flex">
        {headers.map((h, i) => (
          <div
            key={i}
            className="text-[10px] text-[var(--text-tertiary)] text-center py-1
              border-r border-[var(--border-default)] flex-shrink-0"
            style={{ width: h.width, minWidth: h.width }}
          >
            {h.label}
          </div>
        ))}

        {/* Today line */}
        {todayPosition !== null && todayPosition >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent-primary)] z-20 pointer-events-none"
            style={{ left: todayPosition }}
          />
        )}
      </div>
    </div>
  );
}
