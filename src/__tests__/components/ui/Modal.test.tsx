import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "@/components/ui/Modal";

describe("Modal", () => {
  it("should render when open", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test">
        Content
      </Modal>
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        Content
      </Modal>
    );
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("should call onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Content
      </Modal>
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("should have proper ARIA attributes", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        Content
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Test Modal");
  });

  it("should render footer when provided", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} footer={<button>Save</button>}>
        Content
      </Modal>
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("should render close button with title", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test">
        Content
      </Modal>
    );
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });
});
