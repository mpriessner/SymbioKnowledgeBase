import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentPages } from "@/hooks/useRecentPages";

describe("useRecentPages", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should start with empty list", () => {
    const { result } = renderHook(() => useRecentPages());
    expect(result.current.recentPages).toEqual([]);
  });

  it("should add a page to recent list", () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({
        id: "page-1",
        title: "Test Page",
        icon: null,
      });
    });

    expect(result.current.recentPages).toHaveLength(1);
    expect(result.current.recentPages[0].id).toBe("page-1");
  });

  it("should maintain max 5 recent pages", () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.addRecentPage({
          id: `page-${i}`,
          title: `Page ${i}`,
          icon: null,
        });
      }
    });

    expect(result.current.recentPages).toHaveLength(5);
  });

  it("should deduplicate existing pages (move to front)", () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({ id: "a", title: "A", icon: null });
      result.current.addRecentPage({ id: "b", title: "B", icon: null });
      result.current.addRecentPage({ id: "a", title: "A", icon: null });
    });

    expect(result.current.recentPages).toHaveLength(2);
    expect(result.current.recentPages[0].id).toBe("a");
  });

  it("should persist to localStorage", () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({
        id: "page-1",
        title: "Test",
        icon: null,
      });
    });

    const stored = JSON.parse(
      localStorage.getItem("symbio-recent-pages") || "[]"
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("page-1");
  });

  it("should clear recent pages", () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({ id: "a", title: "A", icon: null });
      result.current.clearRecentPages();
    });

    expect(result.current.recentPages).toHaveLength(0);
  });
});
