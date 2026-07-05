import { describe, it, expect, vi, beforeEach } from "vitest";

const TOKEN = "abcdef0123456789abcdef01";

const baseShareLink = {
  id: "share-1",
  pageId: "page-1",
  tenantId: "tenant-1",
  token: TOKEN,
  createdBy: "user-1",
  allowIndexing: false,
  publishedAt: new Date("2026-01-01"),
  expiresAt: new Date("2099-01-01"),
  revokedAt: null as Date | null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  createdByUser: { name: "Ada Lovelace" },
  page: {
    id: "page-1",
    tenantId: "tenant-1",
    title: "Test Page",
    icon: null,
    externalId: "exp-123",
    teamspace: { name: "Chemistry" },
    blocks: [
      {
        id: "block-1",
        type: "DOCUMENT",
        position: 0,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hello world" }],
            },
          ],
        },
      },
    ],
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    publicShareLink: {
      findUnique: vi.fn(),
    },
  },
}));

const { notFoundSpy } = vi.hoisted(() => ({
  notFoundSpy: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: notFoundSpy,
}));

import SharedPage from "@/app/shared/[token]/page";
import { prisma } from "@/lib/db";

function makeProps(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("SharedPage (no format param — existing HTML render)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page (unchanged) for a live token, without calling notFound", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce(
      baseShareLink as never
    );

    const element = await SharedPage(makeProps(TOKEN) as never);

    expect(notFoundSpy).not.toHaveBeenCalled();
    // Structural sanity check that this is still the same HTML tree shape
    // (a div wrapping the shared-page layout), not a JSON/text response.
    expect(element).toBeTruthy();
    expect((element as { type: string }).type).toBe("div");
  });

  it("calls notFound() for a revoked token, honoring the same null-check as the export route", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce({
      ...baseShareLink,
      revokedAt: new Date("2026-02-01"),
    } as never);

    await expect(SharedPage(makeProps(TOKEN) as never)).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("calls notFound() for an expired token", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce({
      ...baseShareLink,
      expiresAt: new Date("2000-01-01"),
    } as never);

    await expect(SharedPage(makeProps(TOKEN) as never)).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("calls notFound() for an unknown token", async () => {
    vi.mocked(prisma.publicShareLink.findUnique).mockResolvedValueOnce(
      null as never
    );

    await expect(SharedPage(makeProps(TOKEN) as never)).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
