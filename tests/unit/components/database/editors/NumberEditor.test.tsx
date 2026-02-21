import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberEditor } from "@/components/database/editors/NumberEditor";

describe("NumberEditor", () => {
  it("should render with initial value", () => {
    render(<NumberEditor value={42} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("should call onSave with parsed number on Enter", () => {
    const onSave = vi.fn();
    render(<NumberEditor value={0} onSave={onSave} onCancel={vi.fn()} />);
    const input = screen.getByDisplayValue("0");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith(99);
  });

  it("should call onSave on blur", () => {
    const onSave = vi.fn();
    render(<NumberEditor value={5} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.blur(screen.getByDisplayValue("5"));
    expect(onSave).toHaveBeenCalledWith(5);
  });

  it("should call onCancel on Escape", () => {
    const onCancel = vi.fn();
    render(<NumberEditor value={0} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByDisplayValue("0"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
