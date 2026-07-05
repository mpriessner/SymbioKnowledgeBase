import type { SpaceType, GeneralAccess } from "@/types/page";

/**
 * Builds the exact string a QR code must encode: `${baseUrl}/shared/${token}`.
 *
 * Deliberately reconstructed client-side from the canonical
 * `NEXT_PUBLIC_PUBLIC_BASE_URL` + the raw `share_token` — NOT read from the
 * publish route's `url` field, which is derived from `x-forwarded-host` /
 * request origin and is `http://localhost:3000` in dev (see a71-09 story
 * Section 2 step 2 / Round 2 finding 2).
 */
export function buildShareUrl(baseUrl: string, shareToken: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  return `${trimmedBase}/shared/${shareToken}`;
}

// `new URL(...).hostname` returns IPv6 literals with their brackets intact
// (e.g. `[::1]`), so both forms are listed here.
const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
]);

/**
 * True when a URL resolves to a loopback/local host that a phone camera can
 * never reach (e.g. `http://localhost:3000/shared/abc`). An unparseable
 * string is treated as unsafe too — fail loud rather than ever emit a QR that
 * silently can't be scanned (AC9).
 */
export function isLoopbackHost(urlString: string): boolean {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase();
    return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
  } catch {
    return true;
  }
}

export interface PageForBatchPublish {
  id: string;
  title: string;
  spaceType: SpaceType;
  generalAccess: GeneralAccess;
  isPublished: boolean;
}

/**
 * A page requires an explicit "this will make it publicly viewable by anyone
 * with the link" confirmation before "Get QR" may publish it — unless it's
 * already an open, shared teamspace page (spaceType `TEAM` AND generalAccess
 * `ANYONE_WITH_LINK`). PRIVATE pages, AGENT pages, and INVITED_ONLY
 * teamspace pages ("restricted teamspace", per the story) all require it.
 *
 * This is the security-critical guard from the epic index / story review:
 * a QR/publish action on a private page must never silently expose it.
 */
export function pageNeedsPublishConfirmation(page: {
  spaceType: SpaceType;
  generalAccess: GeneralAccess;
}): boolean {
  return page.spaceType !== "TEAM" || page.generalAccess === "INVITED_ONLY";
}

/**
 * Partitions a batch selection into three groups so the caller can show
 * exactly one grouped confirmation listing private/restricted page titles
 * instead of one dialog per page (AC11), and never silently auto-publishes
 * a page that needs confirmation.
 */
export function planBatchPublish<T extends PageForBatchPublish>(
  pages: T[]
): { alreadyPublished: T[]; autoPublishable: T[]; needsConfirmation: T[] } {
  const alreadyPublished: T[] = [];
  const autoPublishable: T[] = [];
  const needsConfirmation: T[] = [];

  for (const page of pages) {
    if (page.isPublished) {
      alreadyPublished.push(page);
    } else if (pageNeedsPublishConfirmation(page)) {
      needsConfirmation.push(page);
    } else {
      autoPublishable.push(page);
    }
  }

  return { alreadyPublished, autoPublishable, needsConfirmation };
}

/** Print route `?ids=` contract: comma-separated page UUIDs. */
export function parseIdsParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * URL length limits (~2k conservative, ~8k in Chrome) bound how many UUIDs
 * can safely ride in `?ids=` (~36 chars each). Reject anything beyond the cap
 * with a clear message rather than silently truncating the batch (AC12).
 */
export const MAX_BATCH_PAGE_IDS = 150;

export type BatchIdsValidation =
  | { ok: true; ids: string[] }
  | { ok: false; message: string };

export function validateBatchIds(ids: string[]): BatchIdsValidation {
  if (ids.length === 0) {
    return { ok: false, message: "No pages were selected for printing." };
  }
  if (ids.length > MAX_BATCH_PAGE_IDS) {
    return {
      ok: false,
      message:
        `${ids.length} pages were selected, but a single print sheet supports ` +
        `at most ${MAX_BATCH_PAGE_IDS}. Split your selection into smaller batches.`,
    };
  }
  return { ok: true, ids };
}
