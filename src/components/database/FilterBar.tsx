"use client";

import { useState } from "react";
import type { Column } from "@/types/database";
import type { TableFilter, FilterOperator } from "@/types/tableFilters";
import { OPERATORS_BY_TYPE, OPERATOR_LABELS } from "@/types/tableFilters";

interface FilterBarProps {
  columns: Column[];
  filters: TableFilter[];
  onAddFilter: (filter: TableFilter) => void;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
}

export function FilterBar({
  columns,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
}: FilterBarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newColumnId, setNewColumnId] = useState("");
  const [newOperator, setNewOperator] = useState<FilterOperator>("equals");
  const [newValue, setNewValue] = useState("");

  const selectedColumn = columns.find((c) => c.id === newColumnId);
  const availableOperators = selectedColumn
    ? OPERATORS_BY_TYPE[selectedColumn.type] || []
    : [];

  const handleAdd = () => {
    if (newColumnId && newOperator) {
      onAddFilter({
        columnId: newColumnId,
        operator: newOperator,
        value: newValue,
      });
      setIsAdding(false);
      setNewColumnId("");
      setNewOperator("equals");
      setNewValue("");
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* Active filters */}
      {filters.map((filter, index) => {
        const col = columns.find((c) => c.id === filter.columnId);
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-xs"
          >
            <span className="font-medium">{col?.name || filter.columnId}</span>
            <span className="text-[var(--text-secondary)]">
              {OPERATOR_LABELS[filter.operator]}
            </span>
            {filter.value && <span>&quot;{filter.value}&quot;</span>}
            <button
              onClick={() => onRemoveFilter(index)}
              className="ml-1 hover:text-red-500"
              aria-label="Remove filter"
            >
              x
            </button>
          </span>
        );
      })}

      {/* Add filter form */}
      {isAdding ? (
        <div className="flex items-center gap-1">
          <select
            value={newColumnId}
            onChange={(e) => {
              setNewColumnId(e.target.value);
              const col = columns.find((c) => c.id === e.target.value);
              const ops = col ? OPERATORS_BY_TYPE[col.type] || [] : [];
              setNewOperator(ops[0] || "equals");
            }}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs"
          >
            <option value="">Column...</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {newColumnId && (
            <select
              value={newOperator}
              onChange={(e) =>
                setNewOperator(e.target.value as FilterOperator)
              }
              className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs"
            >
              {availableOperators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
          )}

          {newColumnId &&
            !["is_empty", "is_checked", "is_not_checked"].includes(
              newOperator
            ) && (
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="w-24 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs"
              />
            )}

          <button
            onClick={handleAdd}
            className="rounded bg-[var(--accent-primary)] px-2 py-1 text-xs text-white"
          >
            Apply
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="text-xs text-[var(--accent-primary)] hover:underline"
        >
          + Add filter
        </button>
      )}

      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-xs text-[var(--text-secondary)] hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
