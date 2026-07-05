import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QrPanel } from "@/components/page/QrPanel";
import type { Page } from "@/types/page";

vi.mock("@/hooks/usePages", () => ({
  usePage: vi.fn(),
}));

vi.mock("@/hooks/usePublish", () => ({
  usePublishStatus: vi.fn(),
  usePublishPage: vi.fn(),
  useUnpublishPage: vi.fn(),
}));

import { usePage } from "@/hooks/usePages";
import { usePublishStatus, usePublishPage, useUnpublishPage } from "@/hooks/usePublish";

const mockUsePage = vi.mocked(usePage);
const mockUsePublishStatus = vi.mocked(usePublishStatus);
const mockUsePublishPage = vi.mocked(usePublishPage);
const mockUseUnpublishPage = vi.mocked(useUnpublishPage);

const PAGE_ID = "11111111-1111-1111-1111-111111111111";

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: PAGE_ID,
    tenantId: "tenant-1",
    parentId: null,
    teamspaceId: null,
    spaceType: "PRIVATE",
    generalAccess: "ANYONE_WITH_LINK",
    title: "My private doc",
    icon: null,
    coverUrl: null,
    position: 0,
    oneLiner: null,
    summary: null,
    summaryUpdatedAt: null,
    lastAgentVisitAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface SetupOptions {
  page: Page;
  isPublished?: boolean;
  shareToken?: string | null;
  publishPending?: boolean;
  unpublishPending?: boolean;
}

function setup({
  page,
  isPublished = false,
  shareToken = null,
  publishPending = false,
  unpublishPending = false,
}: SetupOptions) {
  mockUsePage.mockReturnValue({
    data: { data: page, meta: {} },
  } as unknown as ReturnType<typeof usePage>);

  mockUsePublishStatus.mockReturnValue({
    data: {
      data: {
        is_published: isPublished,
        share_token: shareToken,
        url: shareToken ? `http://localhost:3000/shared/${shareToken}` : null,
        published_at: isPublished ? "2026-01-01T00:00:00.000Z" : null,
        allow_indexing: false,
      },
    },
  } as unknown as ReturnType<typeof usePublishStatus>);

  const publishMutate = vi.fn();
  const unpublishMutate = vi.fn();

  mockUsePublishPage.mockReturnValue({
    mutate: publishMutate,
    isPending: publishPending,
  } as unknown as ReturnType<typeof usePublishPage>);

  mockUseUnpublishPage.mockReturnValue({
    mutate: unpublishMutate,
    isPending: unpublishPending,
  } as unknown as ReturnType<typeof useUnpublishPage>);

  render(<QrPanel pageId={PAGE_ID} />);

  return { publishMutate, unpublishMutate };
}

describe("QrPanel — private-page publish confirmation guard (AC8/AC10)", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL = "https://kb.example.com";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL = originalBaseUrl;
  });

  it("does NOT publish when clicking 'Get QR' on a PRIVATE page — shows a confirmation first", () => {
    const { publishMutate } = setup({ page: makePage({ spaceType: "PRIVATE" }) });

    fireEvent.click(screen.getByRole("button", { name: "Get QR" }));

    expect(
      screen.getByText(/this will make the page publicly viewable/i)
    ).toBeInTheDocument();
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it("publishes only after the user explicitly confirms", () => {
    const { publishMutate } = setup({ page: makePage({ spaceType: "PRIVATE" }) });

    fireEvent.click(screen.getByRole("button", { name: "Get QR" }));
    expect(publishMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Publish and generate QR" }));
    expect(publishMutate).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation for an AGENT page too", () => {
    const { publishMutate } = setup({ page: makePage({ spaceType: "AGENT" }) });

    fireEvent.click(screen.getByRole("button", { name: "Get QR" }));

    expect(
      screen.getByText(/this will make the page publicly viewable/i)
    ).toBeInTheDocument();
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it("requires confirmation for a restricted (INVITED_ONLY) TEAM page too", () => {
    const { publishMutate } = setup({
      page: makePage({ spaceType: "TEAM", generalAccess: "INVITED_ONLY" }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Get QR" }));

    expect(
      screen.getByText(/this will make the page publicly viewable/i)
    ).toBeInTheDocument();
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it("does NOT show a confirmation for an open, shared TEAM page — publishes directly", () => {
    const { publishMutate } = setup({
      page: makePage({ spaceType: "TEAM", generalAccess: "ANYONE_WITH_LINK" }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Get QR" }));

    expect(publishMutate).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/this will make the page publicly viewable/i)
    ).not.toBeInTheDocument();
  });

  it("disables 'Get QR' while a publish is already in flight (double-mint guard, AC10)", () => {
    const { publishMutate } = setup({
      page: makePage({ spaceType: "TEAM", generalAccess: "ANYONE_WITH_LINK" }),
      publishPending: true,
    });

    const button = screen.getByRole("button", { name: "Publishing..." });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it("renders a scannable QR image once the page is published, reconstructed from share_token + the canonical base URL (AC9)", () => {
    setup({
      page: makePage({ spaceType: "TEAM", generalAccess: "ANYONE_WITH_LINK" }),
      isPublished: true,
      shareToken: "tok123",
    });

    const img = screen.getByRole("img", { name: /qr code/i });
    expect(img).toBeInTheDocument();
    // Data URL — never encodes localhost even though the mocked publish
    // status's `url` field is localhost; it must come from the canonical
    // base URL + share_token, not the response's `url`.
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("refuses to render a QR and shows an error when the base URL is not configured (AC9)", () => {
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL = "";
    setup({
      page: makePage({ spaceType: "TEAM", generalAccess: "ANYONE_WITH_LINK" }),
      isPublished: true,
      shareToken: "tok123",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/not configured/i);
    expect(screen.queryByRole("img", { name: /qr code/i })).not.toBeInTheDocument();
  });
});
