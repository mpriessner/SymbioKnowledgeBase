import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BacklinksPanel } from "@/components/page/BacklinksPanel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useBacklinks
vi.mock("@/hooks/useBacklinks", () => ({
  useBacklinks: vi.fn(),
}));

import { useBacklinks } from "@/hooks/useBacklinks";
const mockUseBacklinks = vi.mocked(useBacklinks);

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

describe("BacklinksPanel", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("should render backlink count in header", () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [
          { pageId: "id-1", pageTitle: "Page A", pageIcon: null },
          { pageId: "id-2", pageTitle: "Page B", pageIcon: null },
        ],
        meta: { total: 2 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("2 backlinks")).toBeInTheDocument();
  });

  it("should render singular 'backlink' for count of 1", () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [{ pageId: "id-1", pageTitle: "Page A", pageIcon: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("1 backlink")).toBeInTheDocument();
  });

  it("should render backlink entries with titles", () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [
          {
            pageId: "id-1",
            pageTitle: "Installation Guide",
            pageIcon: null,
          },
          {
            pageId: "id-2",
            pageTitle: "Getting Started",
            pageIcon: null,
          },
        ],
        meta: { total: 2 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("Installation Guide")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
  });

  it("should show empty state when no backlinks", () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [],
        meta: { total: 0 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });
    expect(
      screen.getByText("No pages link to this page yet.")
    ).toBeInTheDocument();
  });

  it("should navigate to source page on click", () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [{ pageId: "id-1", pageTitle: "Page A", pageIcon: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByText("Page A"));
    expect(mockPush).toHaveBeenCalledWith("/pages/id-1");
  });

  it("should toggle collapsed/expanded on header click", () => {
    mockUseBacklinks.mockReturnValue({
      data: {
        data: [{ pageId: "id-1", pageTitle: "Page A", pageIcon: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });

    // Initially expanded
    expect(screen.getByText("Page A")).toBeVisible();

    // Click header to collapse
    fireEvent.click(screen.getByText("1 backlink"));
    expect(screen.queryByText("Page A")).not.toBeInTheDocument();

    // Click header to expand
    fireEvent.click(screen.getByText("1 backlink"));
    expect(screen.getByText("Page A")).toBeVisible();
  });

  it("should show loading state", () => {
    mockUseBacklinks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useBacklinks>);

    render(<BacklinksPanel pageId="test-page" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("Loading backlinks...")).toBeInTheDocument();
  });
});
