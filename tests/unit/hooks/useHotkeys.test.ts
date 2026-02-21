import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHotkeys } from "@/hooks/useHotkeys";

describe("useHotkeys", () => {
  it("should call handler when Cmd+K is pressed on macOS", () => {
    const handler = vi.fn();

    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
      configurable: true,
    });

    renderHook(() =>
      useHotkeys([{ key: "k", cmdOrCtrl: true, handler }])
    );

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
    });
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it("should call handler when Ctrl+K is pressed on Windows", () => {
    const handler = vi.fn();

    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      writable: true,
      configurable: true,
    });

    renderHook(() =>
      useHotkeys([{ key: "k", cmdOrCtrl: true, handler }])
    );

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
    });
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it("should not call handler when disabled", () => {
    const handler = vi.fn();

    renderHook(() =>
      useHotkeys([{ key: "k", cmdOrCtrl: true, handler, enabled: false }])
    );

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
    });
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should not call handler without modifier when cmdOrCtrl is required", () => {
    const handler = vi.fn();

    renderHook(() =>
      useHotkeys([{ key: "k", cmdOrCtrl: true, handler }])
    );

    const event = new KeyboardEvent("keydown", { key: "k" });
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });
});
