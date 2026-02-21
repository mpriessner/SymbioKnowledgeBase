import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("should not update value before delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "initial" } }
    );

    rerender({ value: "updated" });
    act(() => vi.advanceTimersByTime(100));

    expect(result.current).toBe("initial");
  });

  it("should update value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "initial" } }
    );

    rerender({ value: "updated" });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe("updated");
  });

  it("should reset timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(100));

    // Still should be 'a' — not enough time passed since last change
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(200));

    // Now 300ms after last change -> should be 'abc'
    expect(result.current).toBe("abc");
  });
});
