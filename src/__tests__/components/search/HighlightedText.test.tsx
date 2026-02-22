import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HighlightedText } from "@/components/search/HighlightedText";

describe("HighlightedText", () => {
  it("should render text with <mark> tags", () => {
    const html = "A guide to <mark>PostgreSQL</mark> setup";
    const { container } = render(<HighlightedText html={html} />);

    const mark = container.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark?.textContent).toBe("PostgreSQL");
  });

  it("should strip dangerous HTML tags", () => {
    const html =
      'A guide <script>alert("xss")</script> to <mark>PostgreSQL</mark>';
    const { container } = render(<HighlightedText html={html} />);

    expect(container.querySelector("script")).not.toBeInTheDocument();

    const mark = container.querySelector("mark");
    expect(mark).toBeInTheDocument();
  });

  it("should handle multiple highlighted terms", () => {
    const html = "Setup <mark>PostgreSQL</mark> on <mark>Linux</mark>";
    const { container } = render(<HighlightedText html={html} />);

    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("PostgreSQL");
    expect(marks[1].textContent).toBe("Linux");
  });

  it("should apply custom className", () => {
    const html = "<mark>test</mark>";
    const { container } = render(
      <HighlightedText html={html} className="text-sm text-red-500" />
    );

    const span = container.querySelector("span");
    expect(span?.className).toContain("text-sm");
    expect(span?.className).toContain("text-red-500");
  });

  it("should have aria-label for accessibility", () => {
    const html = "<mark>test</mark>";
    const { container } = render(
      <HighlightedText html={html} aria-label="Search snippet" />
    );

    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-label")).toBe("Search snippet");
  });

  it("should handle empty string", () => {
    const { container } = render(<HighlightedText html="" />);
    expect(container.textContent).toBe("");
  });

  it("should handle plain text (no marks)", () => {
    const html = "No highlights here";
    const { container } = render(<HighlightedText html={html} />);
    expect(container.textContent).toBe("No highlights here");
  });
});
