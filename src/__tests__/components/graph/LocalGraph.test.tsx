import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Polyfill ResizeObserver for JSDOM
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }
});

vi.mock("react-force-graph-2d", () => ({
  default: () => null,
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockForceGraph() {
      return null;
    };
  },
}));

// Mock GraphLegend, GraphTooltip, and color palette to avoid internal dependencies
vi.mock("@/components/graph/GraphLegend", () => ({
  GraphLegend: () => null,
}));

vi.mock("@/components/graph/GraphTooltip", () => ({
  GraphTooltip: () => null,
}));

vi.mock("@/lib/graph/colorPalette", () => ({
  getNodeColor: () => "#000",
  getNodeRadius: () => 4,
  getNodeRadiusByContent: () => 4,
  getEdgeColor: () => "#ccc",
  graphColors: { light: { page: "#000", database: "#000", orphan: "#000", center: "#000" }, dark: { page: "#fff", database: "#fff", orphan: "#fff", center: "#fff" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useGraphData", () => ({
  useGraphData: vi.fn(),
}));

import { LocalGraph } from "@/components/graph/LocalGraph";
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

describe("LocalGraph", () => {
  it("should render toggle button", () => {
    mockUseGraphData.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<LocalGraph pageId="test-page" />, { wrapper: createWrapper() });
    expect(screen.getByText("Local Graph")).toBeInTheDocument();
  });

  it("should be collapsed by default", () => {
    mockUseGraphData.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<LocalGraph pageId="test-page" />, { wrapper: createWrapper() });
    expect(screen.queryByText("View full graph")).not.toBeInTheDocument();
  });

  it("should expand on toggle click", () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: { nodes: [], edges: [] },
        meta: { nodeCount: 0, edgeCount: 0 },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<LocalGraph pageId="test-page" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText("Local Graph"));

    expect(screen.getByText("View full graph")).toBeInTheDocument();
  });

  it("should show empty state when no connections", () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: {
          nodes: [
            {
              id: "test-page",
              label: "Test",
              icon: null,
              oneLiner: null,
              linkCount: 0,
              updatedAt: "",
              contentLength: 0,
            },
          ],
          edges: [],
        },
        meta: { nodeCount: 1, edgeCount: 0 },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<LocalGraph pageId="test-page" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText("Local Graph"));

    expect(
      screen.getByText("No connections yet. Add wikilinks to build your graph.")
    ).toBeInTheDocument();
  });

  it('should show "View full graph" link when expanded', () => {
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
              contentLength: 0,
            },
            {
              id: "2",
              label: "P2",
              icon: null,
              oneLiner: null,
              linkCount: 1,
              updatedAt: "",
              contentLength: 0,
            },
          ],
          edges: [{ source: "1", target: "2" }],
        },
        meta: { nodeCount: 2, edgeCount: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    render(<LocalGraph pageId="1" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText("Local Graph"));

    const link = screen.getByText("View full graph");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/graph");
  });
});
