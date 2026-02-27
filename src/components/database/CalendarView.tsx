"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { useTableFilters } from "@/hooks/useTableFilters";
import { FilterBar } from "./FilterBar";
import { CalendarDayCell } from "./CalendarDayCell";
import { CalendarEventPill, CalendarEventPillOverlay } from "./CalendarEventPill";
import {
  getMonthGridDays,
  getWeekDays,
  mapRowsToDays,
  dateToKey,
  isSameDay,
  isCurrentMonth,
  formatMonthYear,
  formatWeekdayShort,
  formatWeekdayDate,
  navigateMonth,
  navigateWeek,
} from "@/lib/database/calendar-utils";
import { RowContextMenu } from "./RowContextMenu";
import type {
  DatabaseSchema,
  ViewConfig,
  Column,
  RowProperties,
} from "@/types/database";

interface CalendarViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

interface DbRowWithPage {
  id: string;
  databaseId: string;
  pageId: string | null;
  properties: RowProperties;
  page: { id: string; title: string; icon: string | null } | null;
}

type CalendarMode = "month" | "week";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Simple color map for SELECT values (matches BoardView pattern)
const SELECT_COLORS: Record<string, string> = {
  "Not started": "#94a3b8",
  "In progress": "#3b82f6",
  "Done": "#22c55e",
  "Low": "#94a3b8",
  "Medium": "#eab308",
  "High": "#ef4444",
};

export function CalendarView({
  databaseId,
  schema,
  viewConfig,
  onViewConfigChange,
}: CalendarViewProps) {
  const router = useRouter();
  const { data, isLoading, isError, refetch, createRow, updateRow, deleteRow } =
    useDatabaseRows(databaseId);
  const rows = useMemo(
    () => (data?.data ?? []) as DbRowWithPage[],
    [data?.data]
  );
  const [contextMenu, setContextMenu] = useState<{
    rowId: string;
    title: string;
    x: number;
    y: number;
  } | null>(null);

  const {
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    filteredRows,
  } = useTableFilters(rows);

  // Date columns
  const dateColumns = useMemo(
    () => schema.columns.filter((c) => c.type === "DATE"),
    [schema.columns]
  );

  const [dateColumnId, setDateColumnId] = useState<string>(
    viewConfig.calendar?.dateColumn ?? dateColumns[0]?.id ?? ""
  );

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(today);
  const [mode, setMode] = useState<CalendarMode>("month");

  // Grid days
  const gridDays = useMemo(() => {
    if (mode === "month") {
      return getMonthGridDays(
        currentDate.getFullYear(),
        currentDate.getMonth()
      );
    }
    return getWeekDays(currentDate);
  }, [currentDate, mode]);

  // Map rows to day keys
  const rowsByDay = useMemo(
    () => mapRowsToDays(filteredRows as DbRowWithPage[], dateColumnId),
    [filteredRows, dateColumnId]
  );

  // Find first SELECT column for color dots
  const colorColumn = useMemo(
    () => schema.columns.find((c) => c.type === "SELECT" && c.id !== dateColumnId),
    [schema.columns, dateColumnId]
  );

  // Helpers
  function getTitle(row: DbRowWithPage): string {
    for (const val of Object.values(row.properties)) {
      if (val.type === "TITLE") return val.value as string;
    }
    return row.page?.title ?? "Untitled";
  }

  function getColorDot(row: DbRowWithPage): string | null {
    if (!colorColumn) return null;
    const prop = row.properties[colorColumn.id];
    if (prop?.type === "SELECT" && prop.value) {
      return SELECT_COLORS[prop.value as string] ?? "#94a3b8";
    }
    return null;
  }

  // Prepare calendar rows for each day
  function getCalendarRows(dayKey: string) {
    const dayRows = rowsByDay.get(dayKey) ?? [];
    return dayRows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      properties: row.properties,
      title: getTitle(row),
      colorDot: getColorDot(row),
    }));
  }

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeRow = useMemo(
    () => (activeId ? rows.find((r) => r.id === activeId) : null),
    [activeId, rows]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const rowId = active.id as string;
      const overData = over.data.current;
      if (overData?.type !== "day") return;

      const targetDateStr = overData.date as string; // "YYYY-MM-DD"
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      // Check if date actually changed
      const currentProp = row.properties[dateColumnId];
      const currentDateStr =
        currentProp?.type === "DATE" && currentProp.value
          ? (currentProp.value as string).slice(0, 10)
          : null;

      if (currentDateStr === targetDateStr) return;

      const updatedProperties: RowProperties = {
        ...row.properties,
        [dateColumnId]: { type: "DATE", value: targetDateStr },
      };
      updateRow.mutate({ rowId, properties: updatedProperties });
    },
    [rows, dateColumnId, updateRow]
  );

  // Navigation
  const handleNavigate = useCallback(
    (direction: 1 | -1) => {
      setCurrentDate((prev) =>
        mode === "month"
          ? navigateMonth(prev, direction)
          : navigateWeek(prev, direction)
      );
    },
    [mode]
  );

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Date column change
  const handleDateColumnChange = useCallback(
    (columnId: string) => {
      setDateColumnId(columnId);
      onViewConfigChange({
        calendar: { dateColumn: columnId },
      });
    },
    [onViewConfigChange]
  );

  // Add row on a specific date
  const handleAddRow = useCallback(
    (date: Date) => {
      const titleColumn = schema.columns.find((c) => c.type === "TITLE");
      if (!titleColumn) return;
      createRow.mutate({
        [titleColumn.id]: { type: "TITLE", value: "Untitled" },
        [dateColumnId]: { type: "DATE", value: dateToKey(date) },
      });
    },
    [schema.columns, dateColumnId, createRow]
  );

  const handleRowClick = useCallback(
    (_rowId: string, _pageId: string | null) => {
      // Single-click: no navigation (inline edit will be triggered by CalendarEventPill)
    },
    []
  );

  const handleRowDoubleClick = useCallback(
    (_rowId: string, pageId: string | null) => {
      if (pageId) router.push(`/pages/${pageId}`);
    },
    [router]
  );

  const handleRowTitleSave = useCallback(
    (rowId: string, newTitle: string) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const titleColumnId = Object.entries(row.properties).find(
        ([, v]) => v.type === "TITLE"
      )?.[0];
      if (!titleColumnId) return;
      updateRow.mutate({
        rowId,
        properties: {
          ...row.properties,
          [titleColumnId]: { type: "TITLE", value: newTitle },
        },
      });
    },
    [rows, updateRow]
  );

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-lg bg-[var(--bg-secondary)]" />
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-[var(--text-secondary)]">
        <p>Failed to load data.</p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-3 py-1.5 text-sm rounded border border-[var(--border-default)]
            hover:bg-[var(--bg-hover)] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (dateColumns.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--text-secondary)]">
        <div className="text-center">
          <p className="font-medium">No Date columns found</p>
          <p className="mt-1 text-[var(--text-tertiary)]">
            Add a Date column to use Calendar view
          </p>
        </div>
      </div>
    );
  }

  // Group grid days into weeks for month view
  const weeks: Date[][] = [];
  if (mode === "month") {
    for (let i = 0; i < gridDays.length; i += 7) {
      weeks.push(gridDays.slice(i, i + 7));
    }
  }

  // No-date rows
  const noDateRows = getCalendarRows("no-date");

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Date column selector */}
        {dateColumns.length > 1 && (
          <select
            value={dateColumnId}
            onChange={(e) => handleDateColumnChange(e.target.value)}
            className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)]
              bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            {dateColumns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        )}

        {/* Month / Week toggle */}
        <div className="inline-flex rounded border border-[var(--border-default)] overflow-hidden">
          <button
            onClick={() => setMode("month")}
            className={`px-2.5 py-1 text-xs transition-colors
              ${mode === "month" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
          >
            Month
          </button>
          <button
            onClick={() => setMode("week")}
            className={`px-2.5 py-1 text-xs transition-colors border-l border-[var(--border-default)]
              ${mode === "week" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
          >
            Week
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleNavigate(-1)}
            className="w-6 h-6 flex items-center justify-center rounded
              text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-[var(--text-primary)] min-w-[140px] text-center">
            {formatMonthYear(currentDate)}
          </span>
          <button
            onClick={() => handleNavigate(1)}
            className="w-6 h-6 flex items-center justify-center rounded
              text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Today button */}
        <button
          onClick={handleToday}
          className="px-2.5 py-1 text-xs rounded border border-[var(--border-default)]
            text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          Today
        </button>

        {/* Filter bar */}
        <FilterBar
          columns={schema.columns}
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
          No events scheduled. Click a date to add one.
        </div>
      )}

      {/* Calendar grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="border-l border-t border-[var(--border-default)] rounded-lg overflow-hidden">
          {/* Weekday headers */}
          {mode === "month" ? (
            <>
              <div className="grid grid-cols-7">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider
                      text-[var(--text-secondary)] text-center bg-[var(--bg-secondary)]
                      border-b border-r border-[var(--border-default)]"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Month grid */}
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map((day) => (
                    <CalendarDayCell
                      key={dateToKey(day)}
                      date={day}
                      rows={getCalendarRows(dateToKey(day))}
                      isToday={isSameDay(day, today)}
                      isCurrentMonth={isCurrentMonth(day, currentDate)}
                      onAddRow={handleAddRow}
                      onRowClick={handleRowClick}
                      onRowDoubleClick={handleRowDoubleClick}
                      onRowTitleSave={handleRowTitleSave}
                      onRowContextMenu={(e, rowId, title) => {
                        e.preventDefault();
                        setContextMenu({ rowId, title, x: e.clientX, y: e.clientY });
                      }}
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Week view headers */}
              <div className="grid grid-cols-7">
                {gridDays.map((day) => (
                  <div
                    key={dateToKey(day)}
                    className={`px-2 py-1.5 text-xs font-medium text-center
                      bg-[var(--bg-secondary)] border-b border-r border-[var(--border-default)]
                      ${isSameDay(day, today) ? "text-[var(--accent-primary)] font-semibold" : "text-[var(--text-secondary)]"}`}
                  >
                    {formatWeekdayDate(day)}
                  </div>
                ))}
              </div>

              {/* Week grid (single row of day cells) */}
              <div className="grid grid-cols-7">
                {gridDays.map((day) => (
                  <CalendarDayCell
                    key={dateToKey(day)}
                    date={day}
                    rows={getCalendarRows(dateToKey(day))}
                    isToday={isSameDay(day, today)}
                    isCurrentMonth={true}
                    maxVisible={5}
                    onAddRow={handleAddRow}
                    onRowClick={handleRowClick}
                    onRowDoubleClick={handleRowDoubleClick}
                    onRowTitleSave={handleRowTitleSave}
                    onRowContextMenu={(e, rowId, title) => {
                      e.preventDefault();
                      setContextMenu({ rowId, title, x: e.clientX, y: e.clientY });
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <DragOverlay>
          {activeRow ? (
            <CalendarEventPillOverlay
              title={getTitle(activeRow)}
              colorDot={getColorDot(activeRow)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* No-date section */}
      {noDateRows.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
            No date ({noDateRows.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {noDateRows.map((row) => (
              <CalendarEventPill
                key={row.id}
                rowId={row.id}
                title={row.title}
                colorDot={row.colorDot}
                onClick={() => handleRowClick(row.id, row.pageId)}
                onDoubleClick={() => handleRowDoubleClick(row.id, row.pageId)}
                onTitleSave={(newTitle) => handleRowTitleSave(row.id, newTitle)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ rowId: row.id, title: row.title, x: e.clientX, y: e.clientY });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {contextMenu && (
        <RowContextMenu
          rowId={contextMenu.rowId}
          rowTitle={contextMenu.title}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onDelete={(rowId) => deleteRow.mutate(rowId)}
          onClose={() => setContextMenu(null)}
          isDeleting={deleteRow.isPending}
        />
      )}
    </div>
  );
}
