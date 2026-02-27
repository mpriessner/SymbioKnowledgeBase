import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock react-force-graph completely to avoid AFRAME dependency
vi.mock("react-force-graph", () => ({
  ForceGraph2D: () => null,
}));

// Mock next/dynamic to return a simple passthrough
vi.mock("next/dynamic", () => ({
  default: () => {
    // Return a simple component that renders null (like the mocked ForceGraph2D)
    return function MockForceGraph() {
      return null;
    };
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useGraphData", () => ({
  useGraphData: vi.fn(),
}));

import { GraphView } from "@/components/graph/GraphView";
import { useGraphData } from "@/hooks/useGraphData";
const mockUseGraphData = vi.mocked(useGraphData);

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

describe("GraphView", () => {
  it("should show loading state while fetching", () => {
    mockUseGraphData.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useGraphData>);

    render(<GraphView />, { wrapper: createWrapper() });
    expect(screen.getByText("Loading graph...")).toBeInTheDocument();
  });

  it("should show empty state when no nodes", () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: { nodes: [], edges: [] },
        meta: { nodeCount: 0, edgeCount: 0 },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<GraphView />, { wrapper: createWrapper() });
    expect(screen.getByText("No pages to display.")).toBeInTheDocument();
  });

  it("should render stats footer with node and edge counts", () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: {
          nodes: [
            {
              id: "1",
              label: "P1",
              icon: null,
              oneLiner: null,
              linkCount: 1,
              updatedAt: "",
            },
            {
              id: "2",
              label: "P2",
              icon: null,
              oneLiner: null,
              linkCount: 1,
              updatedAt: "",
            },
          ],
          edges: [{ source: "1", target: "2" }],
        },
        meta: { nodeCount: 2, edgeCount: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<GraphView />, { wrapper: createWrapper() });
    expect(screen.getByText("2 pages, 1 connections")).toBeInTheDocument();
  });
});
