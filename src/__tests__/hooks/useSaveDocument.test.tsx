import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSaveDocument,
  SaveConflictError,
  blockKeys,
} from "@/hooks/useBlockEditor";
import type { Block } from "@/types/editor";

const PAGE_ID = "page-1";

type VersionedBlock = Block & { version?: number };

function docBlock(version: number, content: unknown = { type: "doc" }): VersionedBlock {
  return {
    id: "doc-1",
    tenantId: "t1",
    pageId: PAGE_ID,
    type: "DOCUMENT",
    content: content as Block["content"],
    position: 0,
    version,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

function makeWrapper(seed: VersionedBlock[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(blockKeys.byPage(PAGE_ID), seed);
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("useSaveDocument", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the cached version as expectedVersion and tracks the new version", async () => {
    const { Wrapper } = makeWrapper([docBlock(3)]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: docBlock(4) }));

    const { result } = renderHook(() => useSaveDocument(PAGE_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.saveNow({ type: "doc", content: [] });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.expectedVersion).toBe(3);

    // Second save should now send the version returned by the first (4).
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: docBlock(5) }));
    act(() => {
      result.current.saveNow({ type: "doc", content: [] });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.expectedVersion).toBe(4);
  });

  it("surfaces a SaveConflictError on HTTP 409", async () => {
    const { Wrapper } = makeWrapper([docBlock(3)]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Conflict" } }, 409)
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useSaveDocument(PAGE_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.saveNow({ type: "doc", content: [] }, { onError });
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SaveConflictError);
    await waitFor(() => expect(result.current.isConflict).toBe(true));
  });

  it("keeps the user's content in cache on a transient (non-conflict) error", async () => {
    const { Wrapper, queryClient } = makeWrapper([
      docBlock(3, { type: "doc", original: true }),
    ]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "boom" } }, 500)
    );

    const { result } = renderHook(() => useSaveDocument(PAGE_ID), {
      wrapper: Wrapper,
    });

    const newContent = { type: "doc", edited: true };
    act(() => {
      result.current.saveNow(newContent);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // The optimistic content must NOT be rolled back to the pre-edit snapshot.
    const cached = queryClient.getQueryData<VersionedBlock[]>(
      blockKeys.byPage(PAGE_ID)
    );
    const doc = cached?.find((b) => b.type === "DOCUMENT");
    expect(doc?.content).toEqual(newContent);
  });

  it("rolls back to the server snapshot on a conflict", async () => {
    const original = { type: "doc", original: true };
    const { Wrapper, queryClient } = makeWrapper([docBlock(3, original)]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Conflict" } }, 409)
    );

    const { result } = renderHook(() => useSaveDocument(PAGE_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.saveNow({ type: "doc", edited: true });
    });

    await waitFor(() => expect(result.current.isConflict).toBe(true));

    const cached = queryClient.getQueryData<VersionedBlock[]>(
      blockKeys.byPage(PAGE_ID)
    );
    const doc = cached?.find((b) => b.type === "DOCUMENT");
    expect(doc?.content).toEqual(original);
  });
});
