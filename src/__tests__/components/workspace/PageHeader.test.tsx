import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageHeader } from "@/components/workspace/PageHeader";
import type { Page } from "@/types/page";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockPage: Page = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "tenant-1",
  parentId: null,
  title: "Test Page Title",
  icon: null,
  coverUrl: null,
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PageHeader", () => {
  test("renders the page title", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    expect(
      screen.getByRole("textbox", { name: /page title/i })
    ).toHaveTextContent("Test Page Title");
  });

  test("renders cover image when coverUrl is set", () => {
    const pageWithCover = {
      ...mockPage,
      coverUrl: "https://example.com/cover.jpg",
    };
    render(<PageHeader page={pageWithCover} />, { wrapper: createWrapper() });
    const img = screen.getByAltText("Page cover");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
  });

  test("renders icon when icon is set", () => {
    const pageWithIcon = { ...mockPage, icon: "📄" };
    render(<PageHeader page={pageWithIcon} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Change page icon")).toHaveTextContent("📄");
  });

  test("shows 'Add icon' button when no icon is set", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Add icon")).toBeInTheDocument();
  });

  test("shows 'Add cover' button when no cover is set", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Add cover")).toBeInTheDocument();
  });

  test("title is editable via contentEditable", () => {
    render(<PageHeader page={mockPage} />, { wrapper: createWrapper() });
    const titleElement = screen.getByRole("textbox", { name: /page title/i });
    expect(titleElement).toHaveAttribute("contenteditable", "true");
  });
});
