export type FilterOperator =
  | "equals"
  | "contains"
  | "is_empty"
  | "gt"
  | "lt"
  | "is"
  | "is_not"
  | "not_contains"
  | "before"
  | "after"
  | "is_checked"
  | "is_not_checked";

export interface TableFilter {
  columnId: string;
  operator: FilterOperator;
  value: string;
}

export type SortDirection = "asc" | "desc";

export interface TableSort {
  columnId: string;
  direction: SortDirection;
}

export const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  TITLE: ["equals", "contains", "is_empty"],
  TEXT: ["equals", "contains", "is_empty"],
  NUMBER: ["equals", "gt", "lt"],
  SELECT: ["is", "is_not"],
  MULTI_SELECT: ["contains", "not_contains"],
  DATE: ["is", "before", "after"],
  CHECKBOX: ["is_checked", "is_not_checked"],
  URL: ["equals", "contains", "is_empty"],
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "equals",
  contains: "contains",
  is_empty: "is empty",
  gt: "greater than",
  lt: "less than",
  is: "is",
  is_not: "is not",
  not_contains: "does not contain",
  before: "before",
  after: "after",
  is_checked: "is checked",
  is_not_checked: "is not checked",
};
