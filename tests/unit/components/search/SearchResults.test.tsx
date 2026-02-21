import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchResults } from "@/components/search/SearchResults";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SearchResults", () => {
  const mockResults = [
    {
      pageId: "id-1",
      pageTitle: "PostgreSQL Guide",
      pageIcon: null,
      snippet: "A <mark>powerful</mark> database",
      score: 0.85,
    },
    {
      pageId: "id-2",
      pageTitle: "Database Setup",
      pageIcon: null,
      snippet: "How to <mark>setup</mark>",
      score: 0.62,
    },
  ];

  it("should render result titles", () => {
    render(
      <SearchResults
        results={mockResults}
        isLoading={false}
        query="postgresql"
        selectedIndex={0}
      />
    );
    expect(screen.getByText("PostgreSQL Guide")).toBeInTheDocument();
    expect(screen.getByText("Database Setup")).toBeInTheDocument();
  });

  it("should show loading skeleton when loading", () => {
    const { container } = render(
      <SearchResults
        results={[]}
        isLoading={true}
        query="test"
        selectedIndex={0}
      />
    );
    expect(
      container.querySelectorAll(".animate-pulse").length
    ).toBeGreaterThan(0);
  });

  it("should show no results message", () => {
    render(
      <SearchResults
        results={[]}
        isLoading={false}
        query="nonexistent"
        selectedIndex={0}
      />
    );
    expect(
      screen.getByText(/No results found for/)
    ).toBeInTheDocument();
  });

  it("should show empty state when no query", () => {
    render(
      <SearchResults
        results={[]}
        isLoading={false}
        query=""
        selectedIndex={0}
      />
    );
    expect(
      screen.getByText("Type to search your knowledge base")
    ).toBeInTheDocument();
  });

  it("should call onSelect when result is clicked", () => {
    const onSelect = vi.fn();
    render(
      <SearchResults
        results={mockResults}
        isLoading={false}
        query="test"
        selectedIndex={0}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("PostgreSQL Guide"));
    expect(onSelect).toHaveBeenCalledWith("id-1");
  });

  it("should highlight selected result", () => {
    render(
      <SearchResults
        results={mockResults}
        isLoading={false}
        query="test"
        selectedIndex={1}
      />
    );
    const selectedOption = screen.getAllByRole("option")[1];
    expect(selectedOption.getAttribute("aria-selected")).toBe("true");
  });
});
