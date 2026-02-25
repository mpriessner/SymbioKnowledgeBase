"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Trash2, Pencil, ExternalLink, GripVertical } from "lucide-react";
import { PropertyCell } from "./PropertyCell";
import { PropertyEditor } from "./PropertyEditor";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Column, RowProperties, PropertyValue } from "@/types/database";

interface ListRowProps {
  rowId: string;
  title: string;
  pageId?: string | null;
  properties: RowProperties;
  visibleColumns: Column[];
  isSelected: boolean;
  hasCheckbox: boolean;
  checkboxValue: boolean;
  sortable?: boolean;
  onClick: () => void;
  onCheckboxToggle?: (checked: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onUpdateRow?: (rowId: string, properties: RowProperties) => void;
  onDelete?: (rowId: string) => void;
}

export function ListRow({
  rowId,
  title,
  pageId,
  properties,
  visibleColumns,
  isSelected,
  hasCheckbox,
  checkboxValue,
  sortable,
  onClick,
  onCheckboxToggle,
  onContextMenu,
  onUpdateRow,
  onDelete,
}: ListRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  // Focus title input when editing
  useEffect(() => {
    if (editingField === "__title__" && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingField]);

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
      onUpdateRow(rowId, { ...properties, [columnId]: value });
      setEditingField(null);
    },
    [rowId, properties, onUpdateRow]
  );

  if (showDeleteConfirm) {
    return (
      <Modal
        isOpen={true}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete row"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete?.(rowId);
                setShowDeleteConfirm(false);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[var(--text-secondary)]">
          Delete <span className="font-medium text-[var(--text-primary)]">&quot;{title}&quot;</span>?
          This cannot be undone.
        </p>
      </Modal>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={sortStyle}
      onClick={() => {
        if (!editingField) onClick();
      }}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-2 px-3 h-9 cursor-pointer border-b border-[var(--border-default)] transition-colors
        ${isSelected ? "bg-[var(--accent-primary)]/5" : "hover:bg-[var(--bg-hover)]"}
        ${isDragging ? "z-50 shadow-md bg-[var(--bg-primary)]" : ""}`}
      data-testid={`list-row-${rowId}`}
    >
      {/* Drag handle */}
      {sortable && (
        <button
          {...listeners}
          {...attributes}
          className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100
            text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
            cursor-grab active:cursor-grabbing transition-opacity"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Checkbox */}
      {hasCheckbox && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxToggle?.(!checkboxValue);
          }}
          className="flex-shrink-0 text-sm cursor-pointer"
          aria-label={checkboxValue ? "Uncheck" : "Check"}
        >
          {checkboxValue ? "\u2705" : "\u2B1C"}
        </button>
      )}

      {/* Title */}
      {editingField === "__title__" ? (
        <input
          ref={titleInputRef}
          defaultValue={title}
          className="flex-1 min-w-0 text-sm font-medium text-[var(--text-primary)] bg-transparent
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
        <span
          className="flex-1 min-w-0 text-sm font-medium text-[var(--text-primary)] truncate"
          onClick={(e) => {
            if (onUpdateRow) {
              e.stopPropagation();
              setEditingField("__title__");
            }
          }}
        >
          {title || "Untitled"}
        </span>
      )}

      {/* Property badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
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
              onClick={(e) => {
                if (onUpdateRow) {
                  e.stopPropagation();
                  setEditingField(col.id);
                }
              }}
            >
              <PropertyCell value={value} />
            </span>
          );
        })}
      </div>

      {/* More menu */}
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100
            text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          aria-label="Row options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-[var(--border-default)]
            bg-[var(--bg-primary)] py-1 shadow-lg shadow-black/20">
            {onUpdateRow && (
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-primary)]
                  hover:bg-[var(--bg-hover)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setEditingField("__title__");
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {pageId && (
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-primary)]
                  hover:bg-[var(--bg-hover)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  window.open(`/pages/${pageId}`, "_blank");
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in new tab
              </button>
            )}
            {onDelete && (
              <>
                <div className="my-1 h-px bg-[var(--border-default)]" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[var(--danger)]
                    hover:bg-[var(--danger)]/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
