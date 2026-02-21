"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type {
  TableFilter,
  TableSort,
  SortDirection,
} from "@/types/tableFilters";
import type { RowProperties, PropertyValue } from "@/types/database";

interface RowData {
  id: string;
  properties: RowProperties;
  pageId: string | null;
  page: { id: string; title: string; icon: string | null } | null;
}

export function useTableFilters<T extends RowData>(rows: T[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse filters from URL
  const [filters, setFilters] = useState<TableFilter[]>(() => {
    const filterParams = searchParams.getAll("filter");
    return filterParams.map((f) => {
      const [columnId, operator, ...valueParts] = f.split(":");
      return {
        columnId,
        operator: operator as TableFilter["operator"],
        value: valueParts.join(":"),
      };
    });
  });

  // Parse sort from URL
  const [sort, setSort] = useState<TableSort | null>(() => {
    const sortParam = searchParams.get("sort");
    if (!sortParam) return null;
    const [columnId, direction] = sortParam.split(":");
    return { columnId, direction: (direction || "asc") as SortDirection };
  });

  const syncUrl = useCallback(
    (newFilters: TableFilter[], newSort: TableSort | null) => {
      const params = new URLSearchParams();
      for (const f of newFilters) {
        params.append("filter", `${f.columnId}:${f.operator}:${f.value}`);
      }
      if (newSort) {
        params.set("sort", `${newSort.columnId}:${newSort.direction}`);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const addFilter = useCallback(
    (filter: TableFilter) => {
      const updated = [...filters, filter];
      setFilters(updated);
      syncUrl(updated, sort);
    },
    [filters, sort, syncUrl]
  );

  const removeFilter = useCallback(
    (index: number) => {
      const updated = filters.filter((_, i) => i !== index);
      setFilters(updated);
      syncUrl(updated, sort);
    },
    [filters, sort, syncUrl]
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
    syncUrl([], sort);
  }, [sort, syncUrl]);

  const toggleSort = useCallback(
    (columnId: string) => {
      let newSort: TableSort | null;
      if (sort?.columnId === columnId) {
        newSort =
          sort.direction === "asc"
            ? { columnId, direction: "desc" }
            : null; // Third click removes sort
      } else {
        newSort = { columnId, direction: "asc" };
      }
      setSort(newSort);
      syncUrl(filters, newSort);
    },
    [sort, filters, syncUrl]
  );

  // Apply filters and sort
  const filteredAndSorted = useMemo(() => {
    let result = [...rows];

    // Apply filters (AND logic)
    for (const filter of filters) {
      result = result.filter((row) => {
        const prop = row.properties[filter.columnId];
        return matchesFilter(prop, filter);
      });
    }

    // Apply sort
    if (sort) {
      result.sort((a, b) => {
        const aVal = a.properties[sort.columnId];
        const bVal = b.properties[sort.columnId];
        const cmp = comparePropertyValues(aVal, bVal);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, filters, sort]);

  return {
    filters,
    sort,
    addFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    filteredRows: filteredAndSorted,
    isFiltered: filters.length > 0,
  };
}

function matchesFilter(
  prop: PropertyValue | undefined,
  filter: TableFilter
): boolean {
  if (filter.operator === "is_empty") return !prop || !prop.value;
  if (filter.operator === "is_checked")
    return prop?.type === "CHECKBOX" && prop.value === true;
  if (filter.operator === "is_not_checked")
    return prop?.type === "CHECKBOX" && prop.value === false;

  if (!prop) return false;

  // Handle MULTI_SELECT array values
  if (prop.type === "MULTI_SELECT") {
    const arr = prop.value;
    switch (filter.operator) {
      case "contains":
        return arr.some((v) =>
          v.toLowerCase().includes(filter.value.toLowerCase())
        );
      case "not_contains":
        return !arr.some((v) =>
          v.toLowerCase().includes(filter.value.toLowerCase())
        );
      default:
        return arr.join(", ") === filter.value;
    }
  }

  const val = String(prop.value);

  switch (filter.operator) {
    case "equals":
    case "is":
      return val === filter.value;
    case "is_not":
      return val !== filter.value;
    case "contains":
      return val.toLowerCase().includes(filter.value.toLowerCase());
    case "not_contains":
      return !val.toLowerCase().includes(filter.value.toLowerCase());
    case "gt":
      return Number(val) > Number(filter.value);
    case "lt":
      return Number(val) < Number(filter.value);
    case "before":
      return new Date(val) < new Date(filter.value);
    case "after":
      return new Date(val) > new Date(filter.value);
    default:
      return true;
  }
}

function comparePropertyValues(
  a: PropertyValue | undefined,
  b: PropertyValue | undefined
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  if (a.type === "NUMBER" && b.type === "NUMBER") return a.value - b.value;
  if (a.type === "CHECKBOX" && b.type === "CHECKBOX")
    return Number(a.value) - Number(b.value);
  if (a.type === "DATE" && b.type === "DATE")
    return new Date(a.value).getTime() - new Date(b.value).getTime();

  return String(a.value).localeCompare(String(b.value));
}
