import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Control the save pipeline directly so we can assert serialization /
// supersede behavior without a real network or TanStack Query.
type SaveCb = {
  onSuccess?: () => void;
  onError?: (e: Error) => void;
};
const saveCalls: Array<{ content: unknown; cb?: SaveCb }> = [];
const saveNowMock = vi.fn((content: unknown, cb?: SaveCb) => {
  saveCalls.push({ content, cb });
});

vi.mock("@/hooks/useBlockEditor", () => ({
  useSaveDocument: () => ({
    saveNow: saveNowMock,
    isPending: false,
    isError: false,
    isConflict: false,
    error: null,
  }),
}));

import { useAutoSave } from "@/hooks/useAutoSave";

// Minimal fake TipTap editor: a content getter + update event subscription.
function makeFakeEditor(initial: unknown) {
  let content = initial;
  const handlers: Record<string, Array<() => void>> = {};
  return {
    isDestroyed: false,
    getJSON: () => content,
    setJSON: (c: unknown) => {
      content = c;
    },
    on: (event: string, cb: () => void) => {
      (handlers[event] ||= []).push(cb);
    },
    off: (event: string, cb: () => void) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
    },
    emit: (event: string) => {
      (handlers[event] || []).forEach((h) => h());
    },
  };
}

describe("useAutoSave serialization", () => {
  beforeEach(() => {
    saveCalls.length = 0;
    saveNowMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never runs two saves at once and writes the latest content after the in-flight save", async () => {
    const editor = makeFakeEditor({ v: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHook(() => useAutoSave({ editor: editor as any, pageId: "p1", debounceMs: 10 }));

    // First edit → debounce → save #1 starts (and is left "in flight").
    act(() => {
      editor.setJSON({ v: 1 });
      editor.emit("update");
      vi.advanceTimersByTime(10);
    });
    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0].content).toEqual({ v: 1 });

    // Two more edits arrive WHILE save #1 is in flight. They must be parked,
    // not fired as concurrent saves.
    act(() => {
      editor.setJSON({ v: 2 });
      editor.emit("update");
      vi.advanceTimersByTime(10);
      editor.setJSON({ v: 3 });
      editor.emit("update");
      vi.advanceTimersByTime(10);
    });
    expect(saveCalls).toHaveLength(1); // still only one save in flight

    // Resolve save #1 → the pipeline flushes the LATEST parked content ({v:3}),
    // skipping the superseded {v:2}.
    act(() => {
      saveCalls[0].cb?.onSuccess?.();
    });
    expect(saveCalls).toHaveLength(2);
    expect(saveCalls[1].content).toEqual({ v: 3 });
  });

  it("re-attempts the newest content after a transient save error", async () => {
    const editor = makeFakeEditor({ v: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHook(() => useAutoSave({ editor: editor as any, pageId: "p1", debounceMs: 10 }));

    act(() => {
      editor.setJSON({ v: 1 });
      editor.emit("update");
      vi.advanceTimersByTime(10);
    });
    expect(saveCalls).toHaveLength(1);

    // New edit lands while #1 is in flight, then #1 fails.
    act(() => {
      editor.setJSON({ v: 2 });
      editor.emit("update");
      vi.advanceTimersByTime(10);
    });
    act(() => {
      saveCalls[0].cb?.onError?.(new Error("network"));
    });

    expect(saveCalls).toHaveLength(2);
    expect(saveCalls[1].content).toEqual({ v: 2 });
  });

  it("fires the conflict callback when a save errors with isConflict", () => {
    const editor = makeFakeEditor({ v: 0 });
    const onConflict = vi.fn();
    renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useAutoSave({ editor: editor as any, pageId: "p1", debounceMs: 10, onConflict })
    );

    act(() => {
      editor.emit("update");
      vi.advanceTimersByTime(10);
    });
    const conflictErr = Object.assign(new Error("conflict"), { isConflict: true });
    act(() => {
      saveCalls[0].cb?.onError?.(conflictErr);
    });
    expect(onConflict).toHaveBeenCalledTimes(1);
  });
});
