import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

import { useTheme } from "@/hooks/useTheme";
const mockUseTheme = vi.mocked(useTheme);

describe("ThemeToggle", () => {
  it("should render toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should cycle from light to dark on click", () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      theme: "light",
      resolvedTheme: "light",
      setTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("should cycle from dark to system on click", () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("system");
  });

  it("should cycle from system to light on click", () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      theme: "system",
      resolvedTheme: "light",
      setTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("should show correct aria-label", () => {
    mockUseTheme.mockReturnValue({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    expect(
      screen.getByLabelText("Current theme: dark. Click to change.")
    ).toBeInTheDocument();
  });
});
