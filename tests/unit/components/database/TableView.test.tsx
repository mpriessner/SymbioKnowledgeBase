import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useDatabaseRows", () => ({
  useDatabaseRows: vi.fn(),
}));

import { TableView } from "@/components/database/TableView";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
const mockUseDatabaseRows = vi.mocked(useDatabaseRows);

const qc = new QueryClient();

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
  );
}

describe("TableView", () => {
  const schema = {
    columns: [
      { id: "col1", name: "Title", type: "TITLE" as const },
      {
        id: "col2",
        name: "Status",
        type: "SELECT" as const,
        options: ["Todo", "Done"],
      },
    ],
  };

  it("should render column headers from schema", () => {
    mockUseDatabaseRows.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
      updateRow: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useDatabaseRows>);

    wrap(<TableView databaseId="db-1" schema={schema} />);

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("should show empty state when no rows", () => {
    mockUseDatabaseRows.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
      updateRow: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useDatabaseRows>);

    wrap(<TableView databaseId="db-1" schema={schema} />);

    expect(screen.getByText(/No rows yet/)).toBeInTheDocument();
  });

  it("should render rows with property values", () => {
    mockUseDatabaseRows.mockReturnValue({
      data: {
        data: [
          {
            id: "row-1",
            databaseId: "db-1",
            pageId: "page-1",
            properties: {
              col1: { type: "TITLE", value: "Task A" },
              col2: { type: "SELECT", value: "Done" },
            },
            page: { id: "page-1", title: "Task A", icon: null },
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
      updateRow: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useDatabaseRows>);

    wrap(<TableView databaseId="db-1" schema={schema} />);

    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("should show Add row button", () => {
    mockUseDatabaseRows.mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      createRow: { mutate: vi.fn(), isPending: false },
      updateRow: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useDatabaseRows>);

    wrap(<TableView databaseId="db-1" schema={schema} />);

    expect(screen.getByText("+ Add row")).toBeInTheDocument();
  });

  it("should show loading skeleton", () => {
    mockUseDatabaseRows.mockReturnValue({
      data: undefined,
      isLoading: true,
      createRow: { mutate: vi.fn(), isPending: false },
      updateRow: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useDatabaseRows>);

    const { container } = wrap(
      <TableView databaseId="db-1" schema={schema} />
    );

    expect(
      container.querySelectorAll(".animate-pulse").length
    ).toBeGreaterThan(0);
  });
});
