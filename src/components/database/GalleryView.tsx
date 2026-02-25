"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { useTableFilters } from "@/hooks/useTableFilters";
import { FilterBar } from "./FilterBar";
import { GalleryCard } from "./GalleryCard";
import { CardSizeToggle } from "./CardSizeToggle";
import { PropertyVisibilityToggle } from "./PropertyVisibilityToggle";
import { RowContextMenu } from "./RowContextMenu";
import type {
  DatabaseSchema,
  ViewConfig,
  Column,
  RowProperties,
} from "@/types/database";

interface GalleryViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

type CardSize = "small" | "medium" | "large";

const GRID_COLS: Record<CardSize, string> = {
  small: "grid-cols-3",
  medium: "grid-cols-2",
  large: "grid-cols-1",
};

interface DbRowWithPage {
  id: string;
  databaseId: string;
  pageId: string | null;
  properties: RowProperties;
  page: { id: string; title: string; icon: string | null } | null;
}

export function GalleryView({
  databaseId,
  schema,
  viewConfig,
  onViewConfigChange,
}: GalleryViewProps) {
  const router = useRouter();
  const { data, isLoading, createRow, deleteRow } = useDatabaseRows(databaseId);
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

  // Card size
  const [cardSize, setCardSize] = useState<CardSize>(
    viewConfig.gallery?.cardSize ?? "medium"
  );

  // Cover column (URL type)
  const urlColumns = useMemo(
    () => schema.columns.filter((c) => c.type === "URL"),
    [schema.columns]
  );
  const [coverColumnId, setCoverColumnId] = useState<string | null>(
    viewConfig.gallery?.coverColumn ?? urlColumns[0]?.id ?? null
  );

  // Visible property columns
  const nonTitleColumns = schema.columns.filter(
    (c) => c.type !== "TITLE" && c.type !== "URL"
  );
  const defaultVisible = nonTitleColumns.slice(0, 2).map((c) => c.id);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(defaultVisible);

  const visibleColumns = useMemo(
    () => schema.columns.filter((c) => visibleColumnIds.includes(c.id)),
    [schema.columns, visibleColumnIds]
  );

  // Handlers
  const handleSizeChange = useCallback(
    (size: CardSize) => {
      setCardSize(size);
      onViewConfigChange({
        gallery: {
          cardSize: size,
          coverColumn: coverColumnId ?? "",
        },
      });
    },
    [onViewConfigChange, coverColumnId]
  );

  const handleCoverColumnChange = useCallback(
    (columnId: string) => {
      const newId = columnId === "__none__" ? null : columnId;
      setCoverColumnId(newId);
      onViewConfigChange({
        gallery: {
          cardSize,
          coverColumn: newId ?? "",
        },
      });
    },
    [onViewConfigChange, cardSize]
  );

  const handleToggleVisibility = useCallback(
    (columnId: string) => {
      setVisibleColumnIds((prev) =>
        prev.includes(columnId)
          ? prev.filter((id) => id !== columnId)
          : [...prev, columnId]
      );
    },
    []
  );

  const handleCardClick = useCallback(
    (row: DbRowWithPage) => {
      if (row.pageId) router.push(`/pages/${row.pageId}`);
    },
    [router]
  );

  const handleAddRow = useCallback(() => {
    const titleColumn = schema.columns.find((c) => c.type === "TITLE");
    if (!titleColumn) return;
    createRow.mutate({
      [titleColumn.id]: { type: "TITLE", value: "Untitled" },
    });
  }, [schema.columns, createRow]);

  function getTitle(row: DbRowWithPage): string {
    for (const val of Object.values(row.properties)) {
      if (val.type === "TITLE") return val.value as string;
    }
    return row.page?.title ?? "Untitled";
  }

  function getCoverUrl(row: DbRowWithPage): string | null {
    if (!coverColumnId) return null;
    const prop = row.properties[coverColumnId];
    if (prop?.type === "URL" && prop.value) return prop.value as string;
    return null;
  }

  if (isLoading) {
    return (
      <div className={`grid ${GRID_COLS[cardSize]} gap-4`}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg bg-[var(--bg-secondary)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Cover column selector */}
        {urlColumns.length > 0 && (
          <select
            value={coverColumnId ?? "__none__"}
            onChange={(e) => handleCoverColumnChange(e.target.value)}
            className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)]
              bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            <option value="__none__">No cover</option>
            {urlColumns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        )}

        <CardSizeToggle size={cardSize} onChange={handleSizeChange} />

        <PropertyVisibilityToggle
          columns={schema.columns}
          visibleColumnIds={visibleColumnIds}
          onToggle={handleToggleVisibility}
        />

        <FilterBar
          columns={schema.columns}
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />
      </div>

      {/* Gallery Grid */}
      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-[var(--text-secondary)]">
          <p>
            {filters.length > 0
              ? "No items match the current filter."
              : "No items yet."}
          </p>
          {filters.length === 0 && (
            <button
              onClick={handleAddRow}
              className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm rounded
                border border-dashed border-[var(--border-default)]
                text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add first item
            </button>
          )}
        </div>
      ) : (
        <div
          className={`grid ${GRID_COLS[cardSize]} gap-4 transition-all duration-200`}
        >
          {(filteredRows as DbRowWithPage[]).map((row) => (
            <GalleryCard
              key={row.id}
              rowId={row.id}
              title={getTitle(row)}
              properties={row.properties}
              coverImageUrl={getCoverUrl(row)}
              visibleColumns={visibleColumns}
              showCover={coverColumnId !== null}
              onClick={() => handleCardClick(row)}
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
          ))}

          {/* Add card */}
          <button
            onClick={handleAddRow}
            disabled={createRow.isPending}
            className="rounded-lg border-2 border-dashed border-[var(--border-default)]
              flex items-center justify-center min-h-[120px]
              text-[var(--text-secondary)] hover:text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
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
