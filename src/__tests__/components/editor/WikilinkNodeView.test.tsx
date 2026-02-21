import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WikilinkNodeView } from "@/components/editor/WikilinkNodeView";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch for page existence check
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

describe("WikilinkNodeView", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockFetch.mockClear().mockResolvedValue({ ok: true });
  });

  const defaultProps = {
    node: {
      attrs: {
        pageId: "uuid-123",
        pageName: "Test Page",
        displayText: null,
      },
    },
  } as unknown as import("@tiptap/react").NodeViewProps;

  it("should render the page name as link text", () => {
    render(<WikilinkNodeView {...defaultProps} />);
    expect(screen.getByText("Test Page")).toBeInTheDocument();
  });

  it("should render displayText when provided", () => {
    const props = {
      ...defaultProps,
      node: {
        attrs: {
          pageId: "uuid-123",
          pageName: "Test Page",
          displayText: "Custom Display",
        },
      },
    } as unknown as import("@tiptap/react").NodeViewProps;

    render(<WikilinkNodeView {...props} />);
    expect(screen.getByText("Custom Display")).toBeInTheDocument();
  });

  it("should have blue text styling for existing pages", () => {
    render(<WikilinkNodeView {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("text-blue-600");
  });

  it("should be keyboard accessible", () => {
    render(<WikilinkNodeView {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("tabIndex", "0");
  });
});
