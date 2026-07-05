import { describe, it, expect } from "vitest";
import {
  buildShareUrl,
  isLoopbackHost,
  pageNeedsPublishConfirmation,
  planBatchPublish,
  parseIdsParam,
  validateBatchIds,
  MAX_BATCH_PAGE_IDS,
  type PageForBatchPublish,
} from "@/lib/qrcode/qrPayload";

describe("buildShareUrl", () => {
  it("matches exactly `${baseUrl}/shared/${token}` with no extra query params or trailing content", () => {
    expect(buildShareUrl("https://kb.example.com", "abc123")).toBe(
      "https://kb.example.com/shared/abc123"
    );
  });

  it("strips a trailing slash from the base URL so the join never double-slashes", () => {
    expect(buildShareUrl("https://kb.example.com/", "abc123")).toBe(
      "https://kb.example.com/shared/abc123"
    );
  });
});

describe("isLoopbackHost", () => {
  it.each([
    "http://localhost:3000/shared/abc",
    "http://127.0.0.1:3000/shared/abc",
    "http://0.0.0.0:3000/shared/abc",
    "http://[::1]:3000/shared/abc",
    "http://foo.localhost/shared/abc",
  ])("flags %s as unscannable loopback", (url) => {
    expect(isLoopbackHost(url)).toBe(true);
  });

  it("does not flag a real public host", () => {
    expect(isLoopbackHost("https://kb.example.com/shared/abc")).toBe(false);
  });

  it("fails loud (treats as loopback) for an unparseable string, rather than passing it through", () => {
    expect(isLoopbackHost("not a url")).toBe(true);
  });
});

describe("pageNeedsPublishConfirmation (AC8 / AC11 security guard)", () => {
  it("requires confirmation for a PRIVATE page", () => {
    expect(
      pageNeedsPublishConfirmation({ spaceType: "PRIVATE", generalAccess: "ANYONE_WITH_LINK" })
    ).toBe(true);
  });

  it("requires confirmation for an AGENT page", () => {
    expect(
      pageNeedsPublishConfirmation({ spaceType: "AGENT", generalAccess: "ANYONE_WITH_LINK" })
    ).toBe(true);
  });

  it("requires confirmation for a restricted (INVITED_ONLY) TEAM page", () => {
    expect(
      pageNeedsPublishConfirmation({ spaceType: "TEAM", generalAccess: "INVITED_ONLY" })
    ).toBe(true);
  });

  it("does NOT require confirmation for an open, shared TEAM page", () => {
    expect(
      pageNeedsPublishConfirmation({ spaceType: "TEAM", generalAccess: "ANYONE_WITH_LINK" })
    ).toBe(false);
  });
});

describe("planBatchPublish", () => {
  const pages: PageForBatchPublish[] = [
    { id: "p-private", title: "Private doc", spaceType: "PRIVATE", generalAccess: "ANYONE_WITH_LINK", isPublished: false },
    { id: "p-team-open", title: "Open team page", spaceType: "TEAM", generalAccess: "ANYONE_WITH_LINK", isPublished: false },
    { id: "p-team-restricted", title: "Restricted team page", spaceType: "TEAM", generalAccess: "INVITED_ONLY", isPublished: false },
    { id: "p-already", title: "Already published", spaceType: "PRIVATE", generalAccess: "ANYONE_WITH_LINK", isPublished: true },
  ];

  it("partitions into already-published / auto-publishable / needs-confirmation groups", () => {
    const plan = planBatchPublish(pages);
    expect(plan.alreadyPublished.map((p) => p.id)).toEqual(["p-already"]);
    expect(plan.autoPublishable.map((p) => p.id)).toEqual(["p-team-open"]);
    expect(plan.needsConfirmation.map((p) => p.id)).toEqual([
      "p-private",
      "p-team-restricted",
    ]);
  });

  it("never places a private/restricted unpublished page in the auto-publishable group (cannot get a public URL without confirmation)", () => {
    const plan = planBatchPublish(pages);
    const autoIds = new Set(plan.autoPublishable.map((p) => p.id));
    expect(autoIds.has("p-private")).toBe(false);
    expect(autoIds.has("p-team-restricted")).toBe(false);
  });

  it("shows exactly one grouped list of private titles rather than nothing or a per-page split", () => {
    const plan = planBatchPublish(pages);
    expect(plan.needsConfirmation).toHaveLength(2);
  });
});

describe("parseIdsParam", () => {
  it("splits a comma-separated ids query param and trims whitespace", () => {
    expect(parseIdsParam("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for null/empty input", () => {
    expect(parseIdsParam(null)).toEqual([]);
    expect(parseIdsParam("")).toEqual([]);
  });

  it("filters out empty segments from stray commas", () => {
    expect(parseIdsParam("a,,b,")).toEqual(["a", "b"]);
  });
});

describe("validateBatchIds", () => {
  it("rejects an empty selection", () => {
    const result = validateBatchIds([]);
    expect(result.ok).toBe(false);
  });

  it("accepts a selection within the cap", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`);
    const result = validateBatchIds(ids);
    expect(result).toEqual({ ok: true, ids });
  });

  it("rejects (does not silently truncate) a selection over the cap (AC12)", () => {
    const ids = Array.from({ length: MAX_BATCH_PAGE_IDS + 1 }, (_, i) => `id-${i}`);
    const result = validateBatchIds(ids);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(String(MAX_BATCH_PAGE_IDS));
    }
  });
});
