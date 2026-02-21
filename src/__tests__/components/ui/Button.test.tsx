import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("should render children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("should be disabled when loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should show spinner when loading", () => {
    const { container } = render(<Button loading>Save</Button>);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should call onClick handler", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalled();
  });

  it("should not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click
      </Button>
    );
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should apply variant classes", () => {
    const { rerender } = render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("danger");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button").className).toContain("text-secondary");
  });

  it("should apply size classes", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button").className).toContain("rounded-lg");
  });

  it("should apply fullWidth class", () => {
    render(<Button fullWidth>Full</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");
  });
});
