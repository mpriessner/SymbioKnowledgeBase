"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { CardCover } from "./CardCover";
import { PropertyCell } from "./PropertyCell";
import { PropertyEditor } from "./PropertyEditor";
import type { Column, RowProperties, PropertyValue } from "@/types/database";

interface GalleryCardProps {
  rowId: string;
  title: string;
  properties: RowProperties;
  coverImageUrl: string | null;
  visibleColumns: Column[];
  showCover: boolean;
  sortable?: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onUpdateRow?: (rowId: string, properties: RowProperties) => void;
}

export function GalleryCard({
  rowId,
  title,
  properties,
  coverImageUrl,
  visibleColumns,
  showCover,
  sortable,
  onClick,
  onContextMenu,
  onUpdateRow,
}: GalleryCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId, disabled: !sortable });

  const sortStyle = sortable
    ? {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  useEffect(() => {
    if (editingField === "__title__" && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingField]);

  // Find the title column id from properties
  const titleColumnId = Object.entries(properties).find(
    ([, v]) => v.type === "TITLE"
  )?.[0];

  const handleTitleSave = useCallback(
    (newTitle: string) => {
      if (!titleColumnId || !onUpdateRow) return;
      if (newTitle !== title) {
        onUpdateRow(rowId, {
          ...properties,
          [titleColumnId]: { type: "TITLE", value: newTitle },
        });
      }
      setEditingField(null);
    },
    [rowId, title, titleColumnId, properties, onUpdateRow]
  );

  const handlePropertySave = useCallback(
    (columnId: string, value: PropertyValue) => {
      if (!onUpdateRow) return;
      onUpdateRow(rowId, {
        ...properties,
        [columnId]: value,
      });
      setEditingField(null);
    },
    [rowId, properties, onUpdateRow]
  );

  return (
    <div
      ref={setNodeRef}
      style={sortStyle}
      onClick={() => {
        if (!editingField) onClick();
      }}
      onContextMenu={onContextMenu}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !editingField) onClick();
      }}
      className={`group relative rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
        overflow-hidden cursor-pointer shadow-sm
        hover:shadow-md hover:scale-[1.02] transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]
        ${isDragging ? "z-50 shadow-lg" : ""}`}
      data-testid={`gallery-card-${rowId}`}
    >
      {/* Drag handle */}
      {sortable && (
        <button
          {...listeners}
          {...attributes}
          className="absolute top-2 left-2 z-10 p-0.5 rounded opacity-0 group-hover:opacity-100
            bg-[var(--bg-primary)]/80 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
            cursor-grab active:cursor-grabbing transition-opacity"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Cover */}
      {showCover && (
        <CardCover imageUrl={coverImageUrl} title={title} height={160} />
      )}

      {/* Content */}
      <div className="p-3">
        {editingField === "__title__" ? (
          <input
            ref={titleInputRef}
            defaultValue={title}
            className="w-full text-sm font-medium text-[var(--text-primary)] bg-transparent
              border border-[var(--border-strong)] rounded px-1 py-0.5 outline-none
              focus:ring-1 focus:ring-[var(--accent-primary)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave(e.currentTarget.value);
              else if (e.key === "Escape") setEditingField(null);
            }}
            onBlur={(e) => handleTitleSave(e.currentTarget.value)}
          />
        ) : (
          <h3
            className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 cursor-text"
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdateRow) setEditingField("__title__");
            }}
          >
            {title || "Untitled"}
          </h3>
        )}

        {/* Property badges */}
        {visibleColumns.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleColumns.map((col) => {
              const value = properties[col.id];
              if (!value) return null;

              if (editingField === col.id) {
                return (
                  <div key={col.id} className="text-xs" onClick={(e) => e.stopPropagation()}>
                    <PropertyEditor
                      column={col}
                      value={value}
                      onSave={(val) => handlePropertySave(col.id, val)}
                      onCancel={() => setEditingField(null)}
                    />
                  </div>
                );
              }

              return (
                <span
                  key={col.id}
                  className="text-xs cursor-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateRow) setEditingField(col.id);
                  }}
                >
                  <PropertyCell value={value} />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
