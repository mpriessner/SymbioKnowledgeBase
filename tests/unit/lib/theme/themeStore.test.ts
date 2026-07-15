import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSnapshot,
  setTheme,
  subscribe,
  __resetForTests,
  STORAGE_KEY,
} from "@/lib/theme/themeStore";

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("themeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
    __resetForTests();
  });

  it("notifies all subscribers when the theme changes", () => {
    const callbackA = vi.fn();
    const callbackB = vi.fn();
    const unsubA = subscribe(callbackA);
    const unsubB = subscribe(callbackB);

    setTheme("dark", "user");

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });

  it("a remote-applied change updates the DOM class AND localStorage", () => {
    setTheme("dark", "remote");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(getSnapshot().theme).toBe("dark");
    expect(getSnapshot().resolvedTheme).toBe("dark");
  });

  it("returns a stable (Object.is-equal) snapshot reference until the theme changes", () => {
    const first = getSnapshot();
    const second = getSnapshot();
    expect(first).toBe(second);

    setTheme("dark", "user");
    const third = getSnapshot();
    expect(third).not.toBe(second);
  });

  it("does not throw when localStorage.setItem fails (private-mode browsers)", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

    expect(() => setTheme("dark", "user")).not.toThrow();
    expect(getSnapshot().theme).toBe("dark");

    spy.mockRestore();
  });
});
