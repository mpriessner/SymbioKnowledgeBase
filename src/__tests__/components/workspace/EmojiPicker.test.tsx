import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPicker } from "@/components/workspace/EmojiPicker";

describe("EmojiPicker", () => {
  test("renders search input", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText("Search emojis")).toBeInTheDocument();
  });

  test("renders category tabs", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText("Smileys category")).toBeInTheDocument();
    expect(screen.getByLabelText("Objects category")).toBeInTheDocument();
  });

  test("calls onSelect when emoji is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <EmojiPicker onSelect={onSelect} onClose={onClose} />
    );

    // Click the first emoji button in the grid (skip category tabs and search input)
    const emojiButtons = screen.getAllByRole("button").filter(
      (btn) => btn.getAttribute("aria-label")?.startsWith("Select ")
    );
    if (emojiButtons.length > 0) {
      fireEvent.click(emojiButtons[0]);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  test("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    const onClose = vi.fn();
    render(
      <EmojiPicker
        onSelect={vi.fn()}
        onRemove={onRemove}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByLabelText("Remove icon"));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does not render remove button when onRemove is not provided", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.queryByLabelText("Remove icon")).not.toBeInTheDocument();
  });

  test("focuses search input on mount", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Search emojis"));
  });

  test("switches category when tab is clicked", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText("Objects category"));
    // The category heading text should be visible in the emoji grid area
    const headings = screen.getAllByText("Objects");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  test("closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
