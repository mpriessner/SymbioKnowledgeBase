import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// Mock WorkspaceDropdown to avoid SupabaseProvider dependency
vi.mock("@/components/workspace/WorkspaceDropdown", () => ({
  WorkspaceDropdown: () => <div>Workspace</div>,
}));

// Mock SidebarTeamspaceSection
vi.mock("@/components/workspace/SidebarTeamspaceSection", () => ({
  SidebarTeamspaceSection: ({ label, tree }: { label: string; tree: Array<{ id: string; title: string }> }) => (
    <div>
      <span>{label}</span>
      {tree.map((node: { id: string; title: string }) => (
        <div key={node.id}>{node.title}</div>
      ))}
    </div>
  ),
}));

// Mock BulkActionBar
vi.mock("@/components/sidebar/BulkActionBar", () => ({
  BulkActionBar: () => null,
}));

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

vi.mock("@/hooks/usePages", () => ({
  useCreatePage: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useRecentPages", () => ({
  useRecentPages: () => ({
    recentPages: [],
    addRecentPage: vi.fn(),
    clearRecentPages: vi.fn(),
  }),
}));

vi.mock("@/hooks/useFavorites", () => ({
  useFavoritePages: () => [],
}));

let mockIsCollapsed = false;
const mockToggle = vi.fn(() => {
  mockIsCollapsed = !mockIsCollapsed;
});
vi.mock("@/hooks/useSidebarCollapse", () => ({
  useSidebarCollapse: () => ({
    get isCollapsed() { return mockIsCollapsed; },
    toggle: mockToggle,
  }),
}));

vi.mock("@/hooks/useSidebarWidth", () => ({
  useSidebarWidth: () => ({
    width: 260,
    isResizing: false,
    startResize: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTeamspaces", () => ({
  useTeamspaces: () => ({ data: [] }),
}));

vi.mock("@/hooks/useClientValue", () => ({
  useIsMac: () => true,
}));

vi.mock("@/hooks/useMultiSelect", () => ({
  useMultiSelect: () => ({
    isSelected: () => false,
    handleClick: () => false,
    selectionCount: 0,
    selectedIds: new Set(),
    clearSelection: vi.fn(),
  }),
  flattenVisibleTree: () => [],
}));

vi.mock("@/hooks/useSidebarExpandState", () => ({
  useSidebarExpandState: () => ({
    isExpanded: () => true,
    toggle: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/pages/page-1",
}));

import { Sidebar } from "@/components/workspace/Sidebar";

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
  mockIsCollapsed = false;
  mockToggle.mockClear();
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
  test("renders the sidebar with 'Private' section", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  test("renders 'Create new' button", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Create new")).toBeInTheDocument();
  });

  test("renders 'Collapse sidebar' button", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });

  test("collapses sidebar when toggle button is clicked", () => {
    const { rerender } = render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    // Re-render to pick up the changed state
    rerender(<Sidebar />);

    // After collapsing, should show "Expand sidebar" button
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  test("renders page tree data", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Test Page")).toBeInTheDocument();
  });
});
