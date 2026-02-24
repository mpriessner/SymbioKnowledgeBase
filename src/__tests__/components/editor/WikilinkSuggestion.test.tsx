import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WikilinkSuggestion } from "@/components/editor/WikilinkSuggestion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the usePageSearch hook
vi.mock("@/hooks/usePageSearch", () => ({
  usePageSearch: vi.fn().mockReturnValue({
    data: {
      data: [
        { id: "id-1", title: "Installation Guide", icon: null },
        { id: "id-2", title: "Installing Docker", icon: null },
      ],
    },
    isLoading: false,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  TestWrapper.displayName = "TestWrapper";
  return TestWrapper;
}

describe("WikilinkSuggestion", () => {
  const defaultProps = {
    query: "Install",
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onSelect.mockClear();
    defaultProps.onClose.mockClear();
  });

  it("should render matching pages", () => {
    render(<WikilinkSuggestion {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("Installation Guide")).toBeInTheDocument();
    expect(screen.getByText("Installing Docker")).toBeInTheDocument();
  });

  it("should call onSelect when a page is clicked", () => {
    render(<WikilinkSuggestion {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByText("Installation Guide"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith({
      id: "id-1",
      title: "Installation Guide",
      icon: null,
    });
  });

  it("should show 'No pages found' when no results", async () => {
    const { usePageSearch } = await import("@/hooks/usePageSearch");
    vi.mocked(usePageSearch).mockReturnValueOnce({
      data: { data: [], meta: { total: 0, limit: 10, offset: 0 } },
      isLoading: false,
    } as ReturnType<typeof usePageSearch>);

    render(<WikilinkSuggestion {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("No pages found")).toBeInTheDocument();
  });

  it("should show loading state", async () => {
    const { usePageSearch } = await import("@/hooks/usePageSearch");
    vi.mocked(usePageSearch).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof usePageSearch>);

    render(<WikilinkSuggestion {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it("should have proper accessibility attributes", () => {
    render(<WikilinkSuggestion {...defaultProps} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });
});
