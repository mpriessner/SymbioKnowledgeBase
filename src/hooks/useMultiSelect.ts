"use client";

import { useState, useCallback, useMemo } from "react";
import type { PageTreeNode } from "@/types/page";

export interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  lastClickedId: string | null;
  isSelected: (id: string) => boolean;
  handleClick: (id: string, event: React.MouseEvent) => boolean;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  selectionCount: number;
}

/**
 * Flatten the visible (expanded) tree into a deterministic order for
 * Shift+Click range selection.
 */
export function flattenVisibleTree(
  nodes: PageTreeNode[],
  isExpanded: (id: string) => boolean
): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.id);
    if (node.children.length > 0 && isExpanded(node.id)) {
      result.push(...flattenVisibleTree(node.children, isExpanded));
    }
  }
  return result;
}

export function useMultiSelect(flatOrder: string[]): UseMultiSelectReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectionCount = selectedIds.size;

  /**
   * Returns `true` if the click was consumed by multi-select logic
   * (Cmd/Shift held), meaning the caller should NOT navigate.
   * Returns `false` if it was a plain click — caller should navigate normally.
   */
  const handleClick = useCallback(
    (id: string, event: React.MouseEvent): boolean => {
      const isMeta = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;

      if (isMeta) {
        // Cmd/Ctrl+Click: toggle individual selection
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        setLastClickedId(id);
        return true;
      }

      if (isShift && lastClickedId) {
        // Shift+Click: range select
        const startIdx = flatOrder.indexOf(lastClickedId);
        const endIdx = flatOrder.indexOf(id);
        if (startIdx !== -1 && endIdx !== -1) {
          const from = Math.min(startIdx, endIdx);
          const to = Math.max(startIdx, endIdx);
          const rangeIds = flatOrder.slice(from, to + 1);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const rangeId of rangeIds) {
              next.add(rangeId);
            }
            return next;
          });
        }
        return true;
      }

      // Plain click: clear selection, let navigation proceed
      if (selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
      setLastClickedId(id);
      return false;
    },
    [lastClickedId, flatOrder, selectedIds.size]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  return useMemo(
    () => ({
      selectedIds,
      lastClickedId,
      isSelected,
      handleClick,
      clearSelection,
      selectAll,
      selectionCount,
    }),
    [selectedIds, lastClickedId, isSelected, handleClick, clearSelection, selectAll, selectionCount]
  );
}
