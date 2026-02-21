import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "@/components/database/FilterBar";

describe("FilterBar", () => {
  const columns = [
    { id: "col1", name: "Title", type: "TITLE" as const },
    {
      id: "col2",
      name: "Status",
      type: "SELECT" as const,
      options: ["Todo", "Done"],
    },
  ];

  it("should render active filters", () => {
    render(
      <FilterBar
        columns={columns}
        filters={[{ columnId: "col2", operator: "is", value: "Done" }]}
        onAddFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("is")).toBeInTheDocument();
  });

  it("should show add filter button", () => {
    render(
      <FilterBar
        columns={columns}
        filters={[]}
        onAddFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText("+ Add filter")).toBeInTheDocument();
  });

  it("should call onRemoveFilter when X is clicked", () => {
    const onRemoveFilter = vi.fn();
    render(
      <FilterBar
        columns={columns}
        filters={[{ columnId: "col2", operator: "is", value: "Done" }]}
        onAddFilter={vi.fn()}
        onRemoveFilter={onRemoveFilter}
        onClearAll={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText("Remove filter"));
    expect(onRemoveFilter).toHaveBeenCalledWith(0);
  });

  it("should show clear all button when filters exist", () => {
    render(
      <FilterBar
        columns={columns}
        filters={[{ columnId: "col2", operator: "is", value: "Done" }]}
        onAddFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("should not show clear all button when no filters", () => {
    render(
      <FilterBar
        columns={columns}
        filters={[]}
        onAddFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  it("should show filter form when add filter is clicked", () => {
    render(
      <FilterBar
        columns={columns}
        filters={[]}
        onAddFilter={vi.fn()}
        onRemoveFilter={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("+ Add filter"));
    expect(screen.getByText("Column...")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
