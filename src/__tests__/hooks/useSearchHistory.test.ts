import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchHistory } from "@/hooks/useSearchHistory";

describe("useSearchHistory", () => {
  const TENANT_ID = "test-tenant-123";

  beforeEach(() => {
    localStorage.clear();
  });

  it("should add search to history", () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch("postgresql");
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].query).toBe("postgresql");
  });

  it("should not add duplicate consecutive searches", () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch("postgresql");
    });
    act(() => {
      result.current.addSearch("postgresql");
    });

    expect(result.current.history).toHaveLength(1);
  });

  it("should limit history to 10 items", () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.addSearch(`query ${i}`);
      }
    });

    expect(result.current.history).toHaveLength(10);
  });

  it("should clear history", () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch("test");
    });
    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
  });

  it("should persist to localStorage", () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch("postgresql");
    });

    const stored = localStorage.getItem(`search_history_${TENANT_ID}`);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].query).toBe("postgresql");
  });
});
