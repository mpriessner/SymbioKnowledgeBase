import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertyEditor } from "@/components/database/PropertyEditor";
import type { Column, PropertyValue } from "@/types/database";

describe("PropertyEditor", () => {
  it("should render TextEditor for TEXT column", () => {
    const column: Column = { id: "c1", name: "Notes", type: "TEXT" };
    const value: PropertyValue = { type: "TEXT", value: "Hello" };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Hello")).toBeInTheDocument();
  });

  it("should render TextEditor for TITLE column", () => {
    const column: Column = { id: "c1", name: "Title", type: "TITLE" };
    const value: PropertyValue = { type: "TITLE", value: "My Title" };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("My Title")).toBeInTheDocument();
  });

  it("should render NumberEditor for NUMBER column", () => {
    const column: Column = { id: "c1", name: "Count", type: "NUMBER" };
    const value: PropertyValue = { type: "NUMBER", value: 42 };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("should render SelectEditor for SELECT column", () => {
    const column: Column = {
      id: "c1",
      name: "Status",
      type: "SELECT",
      options: ["Todo", "Done"],
    };
    const value: PropertyValue = { type: "SELECT", value: "Todo" };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("should render DateEditor for DATE column", () => {
    const column: Column = { id: "c1", name: "Due", type: "DATE" };
    const value: PropertyValue = { type: "DATE", value: "2026-01-01" };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("2026-01-01")).toBeInTheDocument();
  });

  it("should render URLEditor for URL column", () => {
    const column: Column = { id: "c1", name: "Link", type: "URL" };
    const value: PropertyValue = { type: "URL", value: "https://example.com" };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
  });

  it("should call onSave with typed PropertyValue", () => {
    const onSave = vi.fn();
    const column: Column = { id: "c1", name: "Notes", type: "TEXT" };
    const value: PropertyValue = { type: "TEXT", value: "Hello" };

    render(
      <PropertyEditor
        column={column}
        value={value}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const input = screen.getByDisplayValue("Hello");
    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).toHaveBeenCalledWith({ type: "TEXT", value: "Updated" });
  });

  it("should use default value when value is undefined", () => {
    const column: Column = { id: "c1", name: "Notes", type: "TEXT" };

    render(
      <PropertyEditor
        column={column}
        value={undefined}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("")).toBeInTheDocument();
  });
});
