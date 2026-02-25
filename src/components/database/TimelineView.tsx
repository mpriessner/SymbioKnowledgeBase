"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { useTableFilters } from "@/hooks/useTableFilters";
import { FilterBar } from "./FilterBar";
import { PropertyEditor } from "./PropertyEditor";
import { PropertyCell } from "./PropertyCell";
import { TimelineBar } from "./TimelineBar";
import { TimeAxis } from "./TimeAxis";
import {
  getPixelsPerDay,
  getTimelineRange,
  dateToPixel,
  generateTimeAxisHeaders,
  generateMonthGroupHeaders,
  type ZoomLevel,
} from "@/lib/database/timeline-utils";
import { addDays } from "date-fns";
import { dateToKey } from "@/lib/database/calendar-utils";
import { RowContextMenu } from "./RowContextMenu";
import type {
  DatabaseSchema,
  ViewConfig,
  RowProperties,
  PropertyValue,
  Column,
} from "@/types/database";

interface TimelineViewProps {
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

// Simple color map for SELECT values
const SELECT_COLORS: Record<string, string> = {
  "Not started": "#94a3b8",
  "In progress": "#3b82f6",
  "Done": "#22c55e",
  "Low": "#94a3b8",
  "Medium": "#eab308",
  "High": "#ef4444",
};

const LANE_HEIGHT = 32;

export function TimelineView({
  databaseId,
  schema,
  viewConfig,
  onViewConfigChange,
}: TimelineViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, createRow, updateRow, deleteRow } =
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
  const [editingSidebar, setEditingSidebar] = useState<{
    rowId: string;
    field: string; // "__title__" or columnId
  } | null>(null);

  // Non-date columns for sidebar property display
  const sidebarColumns = useMemo(
    () => schema.columns.filter((c) => c.type !== "TITLE" && c.type !== "DATE"),
    [schema.columns]
  );

  const handleSidebarSave = useCallback(
    (rowId: string, columnId: string, value: PropertyValue) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      updateRow.mutate({
        rowId,
        properties: { ...row.properties, [columnId]: value },
      });
      setEditingSidebar(null);
    },
    [rows, updateRow]
  );

  const handleTitleSave = useCallback(
    (rowId: string, newTitle: string) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const titleColumnId = Object.entries(row.properties).find(
        ([, v]) => v.type === "TITLE"
      )?.[0];
      if (!titleColumnId) return;
      if (newTitle !== getTitle(row)) {
        updateRow.mutate({
          rowId,
          properties: {
            ...row.properties,
            [titleColumnId]: { type: "TITLE", value: newTitle },
          },
        });
      }
      setEditingSidebar(null);
    },
    [rows, updateRow]
  );

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

  const [startColumnId, setStartColumnId] = useState<string>(
    viewConfig.timeline?.startColumn ?? dateColumns[0]?.id ?? ""
  );
  const [endColumnId, setEndColumnId] = useState<string>(
    viewConfig.timeline?.endColumn ?? dateColumns[1]?.id ?? dateColumns[0]?.id ?? ""
  );

  const [zoom, setZoom] = useState<ZoomLevel>("day");

  // Compute timeline range
  const ppd = getPixelsPerDay(zoom);
  const range = useMemo(
    () =>
      getTimelineRange(
        filteredRows as DbRowWithPage[],
        startColumnId,
        endColumnId
      ),
    [filteredRows, startColumnId, endColumnId]
  );

  const headers = useMemo(
    () => generateTimeAxisHeaders(range.start, range.end, zoom),
    [range, zoom]
  );

  const monthHeaders = useMemo(
    () =>
      zoom === "day"
        ? generateMonthGroupHeaders(range.start, range.end, ppd)
        : undefined,
    [range, zoom, ppd]
  );

  const totalWidth = useMemo(
    () => headers.reduce((sum, h) => sum + h.width, 0),
    [headers]
  );

  const todayPosition = useMemo(
    () => dateToPixel(new Date(), range.start, ppd),
    [range, ppd]
  );

  // Find first SELECT column for bar color
  const colorColumn = useMemo(
    () => schema.columns.find((c) => c.type === "SELECT"),
    [schema.columns]
  );

  function getTitle(row: DbRowWithPage): string {
    for (const val of Object.values(row.properties)) {
      if (val.type === "TITLE") return val.value as string;
    }
    return row.page?.title ?? "Untitled";
  }

  function getBarColor(row: DbRowWithPage): string {
    if (!colorColumn) return "#3b82f6";
    const prop = row.properties[colorColumn.id];
    if (prop?.type === "SELECT" && prop.value) {
      return SELECT_COLORS[prop.value as string] ?? "#3b82f6";
    }
    return "#3b82f6";
  }

  function getDateValue(row: DbRowWithPage, columnId: string): Date | null {
    const prop = row.properties[columnId];
    if (prop?.type === "DATE" && prop.value) {
      return new Date(prop.value as string);
    }
    return null;
  }

  // Handlers
  const handleColumnChange = useCallback(
    (which: "start" | "end", columnId: string) => {
      if (which === "start") setStartColumnId(columnId);
      else setEndColumnId(columnId);
      onViewConfigChange({
        timeline: {
          startColumn: which === "start" ? columnId : startColumnId,
          endColumn: which === "end" ? columnId : endColumnId,
        },
      });
    },
    [onViewConfigChange, startColumnId, endColumnId]
  );

  const handleScrollToToday = useCallback(() => {
    if (scrollRef.current) {
      const pos = todayPosition - scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollLeft = Math.max(0, pos);
    }
  }, [todayPosition]);

  const handleBarMove = useCallback(
    (rowId: string, daysDelta: number) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const startDate = getDateValue(row, startColumnId);
      const endDate = getDateValue(row, endColumnId);

      const props: RowProperties = { ...row.properties };
      if (startDate) {
        props[startColumnId] = {
          type: "DATE",
          value: dateToKey(addDays(startDate, daysDelta)),
        };
      }
      if (endDate && endColumnId !== startColumnId) {
        props[endColumnId] = {
          type: "DATE",
          value: dateToKey(addDays(endDate, daysDelta)),
        };
      }
      updateRow.mutate({ rowId, properties: props });
    },
    [rows, startColumnId, endColumnId, updateRow]
  );

  const handleResizeStart = useCallback(
    (rowId: string, daysDelta: number) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const startDate = getDateValue(row, startColumnId);
      if (!startDate) return;

      const props: RowProperties = {
        ...row.properties,
        [startColumnId]: {
          type: "DATE",
          value: dateToKey(addDays(startDate, daysDelta)),
        },
      };
      updateRow.mutate({ rowId, properties: props });
    },
    [rows, startColumnId, updateRow]
  );

  const handleResizeEnd = useCallback(
    (rowId: string, daysDelta: number) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const endDate = getDateValue(row, endColumnId);
      if (!endDate) return;

      const props: RowProperties = {
        ...row.properties,
        [endColumnId]: {
          type: "DATE",
          value: dateToKey(addDays(endDate, daysDelta)),
        },
      };
      updateRow.mutate({ rowId, properties: props });
    },
    [rows, endColumnId, updateRow]
  );

  const handleRowClick = useCallback(
    (row: DbRowWithPage) => {
      if (row.pageId) router.push(`/pages/${row.pageId}`);
    },
    [router]
  );

  const handleAddRow = useCallback(() => {
    const titleColumn = schema.columns.find((c) => c.type === "TITLE");
    if (!titleColumn) return;
    const today = dateToKey(new Date());
    const weekLater = dateToKey(addDays(new Date(), 7));
    const props: RowProperties = {
      [titleColumn.id]: { type: "TITLE", value: "Untitled" },
      [startColumnId]: { type: "DATE", value: today },
    };
    if (endColumnId !== startColumnId) {
      props[endColumnId] = { type: "DATE", value: weekLater };
    }
    createRow.mutate(props);
  }, [schema.columns, startColumnId, endColumnId, createRow]);

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-lg bg-[var(--bg-secondary)]" />
    );
  }

  if (dateColumns.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--text-secondary)]">
        <div className="text-center">
          <p className="font-medium">No Date columns found</p>
          <p className="mt-1 text-[var(--text-tertiary)]">
            Add two Date columns to use Timeline view
          </p>
        </div>
      </div>
    );
  }

  // Separate rows into those with dates and those without
  const rowsWithDates: DbRowWithPage[] = [];
  const rowsWithoutDates: DbRowWithPage[] = [];
  for (const row of filteredRows as DbRowWithPage[]) {
    const hasStart = getDateValue(row, startColumnId) !== null;
    if (hasStart) rowsWithDates.push(row);
    else rowsWithoutDates.push(row);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Start column selector */}
        <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
          Start:
          <select
            value={startColumnId}
            onChange={(e) => handleColumnChange("start", e.target.value)}
            className="px-1.5 py-1 text-xs rounded border border-[var(--border-default)]
              bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            {dateColumns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        </label>

        {/* End column selector */}
        <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
          End:
          <select
            value={endColumnId}
            onChange={(e) => handleColumnChange("end", e.target.value)}
            className="px-1.5 py-1 text-xs rounded border border-[var(--border-default)]
              bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            {dateColumns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        </label>

        {/* Zoom toggle */}
        <div className="inline-flex rounded border border-[var(--border-default)] overflow-hidden">
          {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2 py-1 text-xs capitalize transition-colors
                ${z === zoom ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}
                ${z !== "day" ? "border-l border-[var(--border-default)]" : ""}`}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Today button */}
        <button
          onClick={handleScrollToToday}
          className="px-2.5 py-1 text-xs rounded border border-[var(--border-default)]
            text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          Today
        </button>

        <FilterBar
          columns={schema.columns}
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />
      </div>

      {/* Timeline */}
      <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="flex">
          {/* Fixed left sidebar: row labels */}
          <div className="w-[180px] flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-primary)]">
            {/* Spacer for axis header */}
            <div
              className="border-b border-[var(--border-default)]"
              style={{ height: monthHeaders ? 52 : 28 }}
            />
            {/* Row labels */}
            {rowsWithDates.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-1 px-2 text-xs text-[var(--text-primary)]
                  border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--bg-hover)]"
                style={{ height: LANE_HEIGHT }}
                onClick={() => {
                  if (!editingSidebar) handleRowClick(row);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    rowId: row.id,
                    title: getTitle(row),
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
              >
                {editingSidebar?.rowId === row.id && editingSidebar.field === "__title__" ? (
                  <input
                    autoFocus
                    defaultValue={getTitle(row)}
                    className="flex-1 min-w-0 text-xs bg-transparent border border-[var(--border-strong)]
                      rounded px-1 outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave(row.id, e.currentTarget.value);
                      else if (e.key === "Escape") setEditingSidebar(null);
                    }}
                    onBlur={(e) => handleTitleSave(row.id, e.currentTarget.value)}
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 truncate"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSidebar({ rowId: row.id, field: "__title__" });
                    }}
                  >
                    {getTitle(row)}
                  </span>
                )}
                {/* First sidebar property badge */}
                {sidebarColumns.length > 0 && (() => {
                  const col = sidebarColumns[0];
                  const val = row.properties[col.id];
                  if (!val) return null;
                  if (editingSidebar?.rowId === row.id && editingSidebar.field === col.id) {
                    return (
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <PropertyEditor
                          column={col}
                          value={val}
                          onSave={(v) => handleSidebarSave(row.id, col.id, v)}
                          onCancel={() => setEditingSidebar(null)}
                        />
                      </div>
                    );
                  }
                  return (
                    <span
                      className="flex-shrink-0 text-[10px] text-[var(--text-secondary)] cursor-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSidebar({ rowId: row.id, field: col.id });
                      }}
                    >
                      <PropertyCell value={val} />
                    </span>
                  );
                })()}
              </div>
            ))}
            {/* Add row button */}
            <button
              onClick={handleAddRow}
              disabled={createRow.isPending}
              className="flex items-center gap-1 px-2 w-full text-xs text-[var(--text-secondary)]
                hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              style={{ height: LANE_HEIGHT }}
            >
              <Plus className="w-3 h-3" />
              Add row
            </button>
          </div>

          {/* Scrollable timeline body */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              {/* Time axis */}
              <TimeAxis
                headers={headers}
                monthHeaders={monthHeaders}
                todayPosition={todayPosition}
              />

              {/* Lanes */}
              <div className="relative">
                {rowsWithDates.map((row) => {
                  const startDate = getDateValue(row, startColumnId);
                  const endDate = getDateValue(row, endColumnId) ?? startDate;
                  if (!startDate) return null;

                  const barLeft = dateToPixel(startDate, range.start, ppd);
                  const barEnd = dateToPixel(
                    endDate ? addDays(endDate, 1) : addDays(startDate, 1),
                    range.start,
                    ppd
                  );
                  const barWidth = barEnd - barLeft;

                  return (
                    <div
                      key={row.id}
                      className="relative border-b border-[var(--border-default)]"
                      style={{ height: LANE_HEIGHT }}
                    >
                      <TimelineBar
                        rowId={row.id}
                        title={getTitle(row)}
                        left={barLeft}
                        width={barWidth}
                        color={getBarColor(row)}
                        pixelsPerDay={ppd}
                        onMove={(d) => handleBarMove(row.id, d)}
                        onResizeStart={(d) => handleResizeStart(row.id, d)}
                        onResizeEnd={(d) => handleResizeEnd(row.id, d)}
                        onClick={() => handleRowClick(row)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            rowId: row.id,
                            title: getTitle(row),
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      />
                    </div>
                  );
                })}

                {/* Today line across all lanes */}
                {todayPosition >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent-primary)] opacity-50 pointer-events-none"
                    style={{ left: todayPosition }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* No-date rows */}
      {rowsWithoutDates.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
            No date ({rowsWithoutDates.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {rowsWithoutDates.map((row) => (
              <div
                key={row.id}
                onClick={() => handleRowClick(row)}
                className="px-2 py-1 text-xs rounded bg-[var(--bg-secondary)]
                  hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              >
                {getTitle(row)}
              </div>
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
