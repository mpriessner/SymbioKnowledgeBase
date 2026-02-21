import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchDialog } from "@/components/search/SearchDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useSearch
vi.mock("@/hooks/useSearch", () => ({
  useSearch: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("SearchDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input when open", () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    expect(
      screen.getByPlaceholderText("Search knowledge base...")
    ).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    renderWithProviders(
      <SearchDialog isOpen={false} onClose={onClose} />
    );
    expect(
      screen.queryByPlaceholderText("Search knowledge base...")
    ).not.toBeInTheDocument();
  });

  it("should show initial empty state", () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    expect(
      screen.getByText("Type to search your knowledge base")
    ).toBeInTheDocument();
  });

  it("should call onClose when Escape is pressed", () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    const input = screen.getByPlaceholderText("Search knowledge base...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("should show keyboard navigation hints", () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    expect(screen.getByText("Navigate")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
