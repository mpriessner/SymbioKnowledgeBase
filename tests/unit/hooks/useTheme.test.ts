import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "@/hooks/useTheme";

// Mock matchMedia for jsdom
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: mockMatchMedia,
});

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia.mockClear();
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("should default to system theme", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("system");
  });

  it("should apply dark class when set to dark", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("should remove dark class when set to light", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(result.current.resolvedTheme).toBe("light");
  });

  it("should persist theme to localStorage", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(localStorage.getItem("symbio-theme")).toBe("dark");
  });

  it("should read theme from localStorage on mount", () => {
    localStorage.setItem("symbio-theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });
});
