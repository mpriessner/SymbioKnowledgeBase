import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TextEditor } from "@/components/database/editors/TextEditor";

describe("TextEditor", () => {
  it("should render with initial value", () => {
    render(<TextEditor value="hello" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("should call onSave on Enter", () => {
    const onSave = vi.fn();
    render(<TextEditor value="hello" onSave={onSave} onCancel={vi.fn()} />);
    const input = screen.getByDisplayValue("hello");
    fireEvent.change(input, { target: { value: "world" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("world");
  });

  it("should call onCancel on Escape", () => {
    const onCancel = vi.fn();
    render(<TextEditor value="hello" onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByDisplayValue("hello"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("should call onSave on blur", () => {
    const onSave = vi.fn();
    render(<TextEditor value="hello" onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.blur(screen.getByDisplayValue("hello"));
    expect(onSave).toHaveBeenCalledWith("hello");
  });
});
