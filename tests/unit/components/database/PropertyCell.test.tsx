import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertyCell } from "@/components/database/PropertyCell";

describe("PropertyCell", () => {
  it("should render dash for undefined value", () => {
    render(<PropertyCell value={undefined} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("should render text value", () => {
    render(<PropertyCell value={{ type: "TEXT", value: "hello" }} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("should render number value", () => {
    render(<PropertyCell value={{ type: "NUMBER", value: 42 }} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("should render select value as pill", () => {
    render(<PropertyCell value={{ type: "SELECT", value: "Done" }} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("should render multi-select values as pills", () => {
    render(
      <PropertyCell
        value={{ type: "MULTI_SELECT", value: ["A", "B"] }}
      />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("should render checkbox as icon", () => {
    const { container } = render(
      <PropertyCell value={{ type: "CHECKBOX", value: true }} />
    );
    expect(container.textContent).toContain("\u2705");
  });

  it("should render URL as link", () => {
    render(
      <PropertyCell value={{ type: "URL", value: "https://example.com/path" }} />
    );
    const link = screen.getByText("example.com");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://example.com/path");
  });

  it("should render date formatted", () => {
    render(
      <PropertyCell value={{ type: "DATE", value: "2026-03-15" }} />
    );
    expect(screen.getByText(/Mar/)).toBeInTheDocument();
  });
});
