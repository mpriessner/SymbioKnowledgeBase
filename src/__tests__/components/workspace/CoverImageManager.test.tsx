import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoverImageManager } from "@/components/workspace/CoverImageManager";

describe("CoverImageManager", () => {
  test("renders cover image when coverUrl is provided", () => {
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const img = screen.getByAltText("Page cover");
    expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
  });

  test("shows Change/Remove buttons on hover of cover image", () => {
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Change cover image")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove cover image")).toBeInTheDocument();
  });

  test("calls onRemove when Remove cover button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByLabelText("Remove cover image"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("shows URL input when Change cover is clicked", () => {
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText("Change cover image"));
    expect(screen.getByLabelText("Cover image URL")).toBeInTheDocument();
  });

  test("renders nothing when coverUrl is null and not editing", () => {
    const { container } = render(
      <CoverImageManager
        coverUrl={null}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});
