import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/workspace/Sidebar";

// Mock matchMedia for useTheme
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the hooks
vi.mock("@/hooks/usePageTree", () => ({
  usePageTree: () => ({
    data: {
      data: [
        {
          id: "page-1",
          tenantId: "t1",
          parentId: null,
          title: "Test Page",
          icon: null,
          coverUrl: null,
          position: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          children: [],
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/pages/page-1",
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { value: localStorageMock });
  localStorageMock.clear();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("Sidebar", () => {
  test("renders the sidebar with 'Pages' header", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Pages")).toBeInTheDocument();
  });

  test("renders 'New page' button", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Create new page")).toBeInTheDocument();
  });

  test("renders 'Collapse sidebar' button", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });

  test("collapses sidebar when toggle button is clicked", () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    // After collapsing, should show "Expand sidebar" button
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    // "Pages" header should no longer be visible
    expect(screen.queryByText("Pages")).not.toBeInTheDocument();
  });

  test("renders page tree data", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Test Page")).toBeInTheDocument();
  });
});
