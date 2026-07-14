import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "@/hooks/useTheme";
import { __resetForTests } from "@/lib/theme/themeStore";

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
    // The theme store is a module-level singleton (by design — a single
    // shared store instead of per-hook-instance state), so it must be
    // re-initialized from the (just-cleared) localStorage between tests.
    __resetForTests();
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
    // The store snapshots localStorage once (module-level singleton, not
    // per-render local state) — re-sync it after writing localStorage
    // directly, the same way a fresh page load would read it.
    __resetForTests();
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });
});
