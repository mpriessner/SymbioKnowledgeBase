import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnhancedSearchDialog } from "@/components/search/EnhancedSearchDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

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

describe("EnhancedSearchDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render when open", () => {
    renderWithProviders(
      <EnhancedSearchDialog isOpen={true} onClose={onClose} />
    );
    expect(
      screen.getByPlaceholderText("Search knowledge base...")
    ).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    renderWithProviders(
      <EnhancedSearchDialog isOpen={false} onClose={onClose} />
    );
    expect(
      screen.queryByPlaceholderText("Search knowledge base...")
    ).not.toBeInTheDocument();
  });

  it("should close on Escape key", () => {
    renderWithProviders(
      <EnhancedSearchDialog isOpen={true} onClose={onClose} />
    );
    const input = screen.getByPlaceholderText("Search knowledge base...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("should close on backdrop click", () => {
    renderWithProviders(
      <EnhancedSearchDialog isOpen={true} onClose={onClose} />
    );
    const backdrop = screen.getByRole("dialog").parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("should show keyboard hints", () => {
    renderWithProviders(
      <EnhancedSearchDialog isOpen={true} onClose={onClose} />
    );
    expect(screen.getByText("Navigate")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
