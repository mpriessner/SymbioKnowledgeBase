import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { act } from "react";
import { ThemeSyncBridge } from "@/components/providers/ThemeSyncBridge";
import { __resetForTests, getSnapshot, setTheme as storeSetTheme } from "@/lib/theme/themeStore";

const mockUseSupabaseClient = vi.fn();
const mockUseUser = vi.fn();
const mockUseAuthLoading = vi.fn();

vi.mock("@/components/providers/SupabaseProvider", () => ({
  useSupabaseClient: () => mockUseSupabaseClient(),
  useUser: () => mockUseUser(),
  useAuthLoading: () => mockUseAuthLoading(),
}));

const mockFetchPreference = vi.fn();
const mockSeedPreference = vi.fn();
const mockUpdatePreference = vi.fn();
const mockSubscribeToPreference = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock("@/lib/theme/themeSync", () => ({
  fetchPreference: (...args: unknown[]) => mockFetchPreference(...args),
  seedPreference: (...args: unknown[]) => mockSeedPreference(...args),
  updatePreference: (...args: unknown[]) => mockUpdatePreference(...args),
  subscribeToPreference: (...args: unknown[]) => mockSubscribeToPreference(...args),
  generateWriteId: (() => {
    let n = 0;
    return () => `wid-${++n}`;
  })(),
}));

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
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

const FAKE_CLIENT = { fake: "client" };

describe("ThemeSyncBridge", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia();
    __resetForTests();

    mockUseSupabaseClient.mockReset();
    mockUseUser.mockReset();
    mockUseAuthLoading.mockReset();
    mockFetchPreference.mockReset();
    mockSeedPreference.mockReset();
    mockUpdatePreference.mockReset().mockResolvedValue(undefined);
    mockSubscribeToPreference.mockReset().mockImplementation(() => mockRemoveChannel);
    mockRemoveChannel.mockReset();

    mockUseAuthLoading.mockReturnValue(false);
  });

  it("no-ops when signed out (no fetch/subscribe/write)", async () => {
    mockUseSupabaseClient.mockReturnValue(null);
    mockUseUser.mockReturnValue(null);

    render(<ThemeSyncBridge />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchPreference).not.toHaveBeenCalled();
    expect(mockSeedPreference).not.toHaveBeenCalled();
    expect(mockSubscribeToPreference).not.toHaveBeenCalled();
    expect(mockUpdatePreference).not.toHaveBeenCalled();
  });

  it("applies the remote row on initial reconcile when a row exists", async () => {
    mockUseSupabaseClient.mockReturnValue(FAKE_CLIENT);
    mockUseUser.mockReturnValue({ id: "user-1" });
    mockFetchPreference.mockResolvedValue({
      user_id: "user-1",
      theme: "dark",
      updated_at: new Date().toISOString(),
      updated_by: "skb",
      write_id: null,
    });

    render(<ThemeSyncBridge />);

    await waitFor(() => expect(getSnapshot().theme).toBe("dark"));
    expect(mockSubscribeToPreference).toHaveBeenCalledTimes(1);
  });

  it("seeds insert-only when no remote row exists and applies the winner", async () => {
    mockUseSupabaseClient.mockReturnValue(FAKE_CLIENT);
    mockUseUser.mockReturnValue({ id: "user-1" });
    mockFetchPreference.mockResolvedValue(null);
    mockSeedPreference.mockResolvedValue({
      user_id: "user-1",
      theme: "light",
      updated_at: new Date().toISOString(),
      updated_by: "skb",
      write_id: null,
    });

    render(<ThemeSyncBridge />);

    await waitFor(() => expect(mockSeedPreference).toHaveBeenCalledWith(FAKE_CLIENT, "user-1", "system"));
    await waitFor(() => expect(getSnapshot().theme).toBe("light"));
  });

  it("pushes exactly one remote write for a single user-origin toggle, after init", async () => {
    mockUseSupabaseClient.mockReturnValue(FAKE_CLIENT);
    mockUseUser.mockReturnValue({ id: "user-1" });
    mockFetchPreference.mockResolvedValue({
      user_id: "user-1",
      theme: "light",
      updated_at: new Date().toISOString(),
      updated_by: "skb",
      write_id: null,
    });

    render(<ThemeSyncBridge />);
    await waitFor(() => expect(mockSubscribeToPreference).toHaveBeenCalledTimes(1));
    mockUpdatePreference.mockClear();

    act(() => {
      storeSetTheme("dark", "user");
    });

    await waitFor(() => expect(mockUpdatePreference).toHaveBeenCalledTimes(1));
    expect(mockUpdatePreference).toHaveBeenCalledWith(FAKE_CLIENT, "user-1", "dark", expect.any(String));
  });

  it("does not push when the store changes with 'remote' origin (no echo write)", async () => {
    mockUseSupabaseClient.mockReturnValue(FAKE_CLIENT);
    mockUseUser.mockReturnValue({ id: "user-1" });
    mockFetchPreference.mockResolvedValue({
      user_id: "user-1",
      theme: "light",
      updated_at: new Date().toISOString(),
      updated_by: "skb",
      write_id: null,
    });

    render(<ThemeSyncBridge />);
    await waitFor(() => expect(mockSubscribeToPreference).toHaveBeenCalledTimes(1));
    mockUpdatePreference.mockClear();

    act(() => {
      storeSetTheme("dark", "remote");
    });

    // Give any (incorrect) async push a chance to fire before asserting absence.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockUpdatePreference).not.toHaveBeenCalled();
  });

  it("suppresses a realtime echo carrying this session's own write_id", async () => {
    mockUseSupabaseClient.mockReturnValue(FAKE_CLIENT);
    mockUseUser.mockReturnValue({ id: "user-1" });
    mockFetchPreference.mockResolvedValue({
      user_id: "user-1",
      theme: "light",
      updated_at: new Date().toISOString(),
      updated_by: "skb",
      write_id: null,
    });

    let realtimeHandler: ((row: Record<string, unknown>) => void) | undefined;
    mockSubscribeToPreference.mockImplementation((_client, _userId, onChange) => {
      realtimeHandler = onChange;
      return mockRemoveChannel;
    });

    render(<ThemeSyncBridge />);
    await waitFor(() => expect(mockSubscribeToPreference).toHaveBeenCalledTimes(1));

    // Trigger a user-origin push so a write_id gets recorded as "issued".
    act(() => {
      storeSetTheme("dark", "user");
    });
    await waitFor(() => expect(mockUpdatePreference).toHaveBeenCalledTimes(1));
    const issuedWriteId = mockUpdatePreference.mock.calls[0][3] as string;

    // Echo of our own write: must be ignored (store stays 'dark', not re-applied/looped).
    act(() => {
      realtimeHandler?.({
        user_id: "user-1",
        theme: "light",
        updated_at: new Date().toISOString(),
        updated_by: "skb",
        write_id: issuedWriteId,
      });
    });
    expect(getSnapshot().theme).toBe("dark");

    // A genuinely different write (different write_id) IS applied.
    act(() => {
      realtimeHandler?.({
        user_id: "user-1",
        theme: "light",
        updated_at: new Date().toISOString(),
        updated_by: "skb",
        write_id: "some-other-devices-write",
      });
    });
    expect(getSnapshot().theme).toBe("light");
  });

  it("tears down the realtime channel and re-initializes on sign-out", async () => {
    mockUseSupabaseClient.mockReturnValue(FAKE_CLIENT);
    mockUseUser.mockReturnValue({ id: "user-1" });
    mockFetchPreference.mockResolvedValue({
      user_id: "user-1",
      theme: "light",
      updated_at: new Date().toISOString(),
      updated_by: "skb",
      write_id: null,
    });

    const { rerender } = render(<ThemeSyncBridge />);
    await waitFor(() => expect(mockSubscribeToPreference).toHaveBeenCalledTimes(1));

    mockUseUser.mockReturnValue(null);
    mockUseSupabaseClient.mockReturnValue(null);
    rerender(<ThemeSyncBridge />);

    await waitFor(() => expect(mockRemoveChannel).toHaveBeenCalledTimes(1));
  });
});
