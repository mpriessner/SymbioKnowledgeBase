import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveChemistryWikilink } from "@/lib/chemistryKb/wikilinkResolver";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    block: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockPageFindFirst = vi.mocked(prisma.page.findFirst);
const mockPageFindUnique = vi.mocked(prisma.page.findUnique);
const mockBlockFindMany = vi.mocked(prisma.block.findMany);

describe("resolveChemistryWikilink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no matches
    mockPageFindFirst.mockResolvedValue(null);
    mockBlockFindMany.mockResolvedValue([]);
  });

  it("should return null for empty link text", async () => {
    const result = await resolveChemistryWikilink("", "tenant-1");
    expect(result).toBeNull();
  });

  it("should return null for whitespace-only link text", async () => {
    const result = await resolveChemistryWikilink("   ", "tenant-1");
    expect(result).toBeNull();
  });

  it("should resolve exact title match", async () => {
    mockPageFindFirst.mockResolvedValue({
      id: "page-1",
      title: "Palladium Acetate",
    } as any);

    const result = await resolveChemistryWikilink("Palladium Acetate", "tenant-1");
    expect(result).toEqual({
      pageId: "page-1",
      pageTitle: "Palladium Acetate",
      matchType: "exact",
    });
  });

  it("should resolve synonym match when no exact match exists", async () => {
    mockPageFindFirst.mockResolvedValue(null);
    mockBlockFindMany
      .mockResolvedValueOnce([
        {
          pageId: "page-2",
          content: { common_synonyms: ["Pd(OAc)2"] },
        } as any,
      ])
      // Second call for case-insensitive fallback shouldn't be needed
      .mockResolvedValueOnce([]);

    mockPageFindUnique.mockResolvedValue({
      id: "page-2",
      title: "Palladium Acetate",
    } as any);

    const result = await resolveChemistryWikilink("Pd(OAc)2", "tenant-1");
    expect(result).toEqual({
      pageId: "page-2",
      pageTitle: "Palladium Acetate",
      matchType: "synonym",
    });
  });

  it("should return null when no match is found", async () => {
    mockPageFindFirst.mockResolvedValue(null);
    mockBlockFindMany.mockResolvedValue([]);

    const result = await resolveChemistryWikilink("Nonexistent Chemical", "tenant-1");
    expect(result).toBeNull();
  });

  it("should trim whitespace from link text before searching", async () => {
    mockPageFindFirst.mockResolvedValue({
      id: "page-1",
      title: "Sodium Chloride",
    } as any);

    await resolveChemistryWikilink("  Sodium Chloride  ", "tenant-1");

    expect(mockPageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: expect.objectContaining({
            equals: "Sodium Chloride",
          }),
        }),
      })
    );
  });

  it("should resolve case-insensitive synonym match as fallback", async () => {
    mockPageFindFirst.mockResolvedValue(null);
    // First findMany (exact synonym) returns empty
    mockBlockFindMany
      .mockResolvedValueOnce([])
      // Second findMany (case-insensitive fallback) returns candidate
      .mockResolvedValueOnce([
        {
          pageId: "page-3",
          content: { common_synonyms: ["pd(oac)2"] },
        } as any,
      ]);

    mockPageFindUnique.mockResolvedValue({
      id: "page-3",
      title: "Palladium Acetate",
    } as any);

    const result = await resolveChemistryWikilink("PD(OAC)2", "tenant-1");
    expect(result).toEqual({
      pageId: "page-3",
      pageTitle: "Palladium Acetate",
      matchType: "synonym",
    });
  });
});
