import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { computeTextDiff } from "./diff";
import { updatePageLinks } from "@/lib/wikilinks/indexer";
import { updateSearchIndex } from "@/lib/search/indexer";
import { syncPageToFilesystem } from "@/lib/sync/SyncService";
import type { TipTapDocument } from "@/lib/wikilinks/types";

// ─── Config (env-tunable) ────────────────────────────────────────────────────
// Coalescing window: consecutive MANUAL saves by the SAME user within this many
// minutes reuse the latest snapshot instead of minting a new one, so rapid
// autosaves don't spam the history.
const COALESCE_WINDOW_MS =
  parseInt(process.env.VERSION_COALESCE_WINDOW_MINUTES || "10", 10) * 60_000;
// Always snapshot (bypass coalescing) when the plainText word-delta since the
// latest version is at least this large.
const LARGE_DELTA_WORDS = parseInt(
  process.env.VERSION_LARGE_DELTA_WORDS || "50",
  10
);
// Retention: keep at most this many versions per page; older ones are pruned
// inside the same transaction that creates a new version.
const RETENTION_LIMIT = parseInt(
  process.env.VERSION_RETENTION_LIMIT || "100",
  10
);

// Duck-typed P2002 detection (matches the repo convention — no Prisma value
// import needed). Raised when the editor's per-save snapshot races machine sync
// on @@unique([pageId, version]).
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

interface CreateVersionOptions {
  pageId: string;
  tenantId: string;
  content: Prisma.InputJsonValue;
  plainText: string;
  changeType:
    | "MANUAL"
    | "AUTO_SYNC"
    | "PROPAGATED"
    | "MACHINE_UPDATE"
    | "AI_SUGGESTED";
  changeSource?: string;
  changeNotes?: string;
}

/**
 * Prune versions beyond the retention limit for a page, inside the given
 * transaction. Keeps the newest `RETENTION_LIMIT` versions (highest version
 * numbers) and deletes the rest.
 *
 * W81-A2: a `DocumentVersion` referenced by any `Claim.documentVersionId` is a
 * pinned per-version snapshot and MUST NOT be pruned — the FK is
 * `onDelete: Restrict`, so a blind delete would FK-violate the whole enclosing
 * save on re-enrich-heavy pages. Claim-referenced versions are filtered out of
 * the delete set (they are retained beyond the retention limit deliberately).
 */
export async function pruneOldVersions(
  tx: Prisma.TransactionClient,
  pageId: string,
  tenantId: string
) {
  if (RETENTION_LIMIT <= 0) return;
  const stale = await tx.documentVersion.findMany({
    where: { pageId, tenantId },
    orderBy: { version: "desc" },
    select: { id: true },
    skip: RETENTION_LIMIT,
  });
  if (stale.length === 0) return;

  const staleIds = stale.map((v) => v.id);
  // Exclude versions still referenced by a Claim (onDelete: Restrict) — deleting
  // them would abort the transaction.
  const referenced = await tx.claim.findMany({
    where: { tenantId, documentVersionId: { in: staleIds } },
    select: { documentVersionId: true },
  });
  const pinned = new Set(referenced.map((c) => c.documentVersionId));
  const deletable = staleIds.filter((id) => !pinned.has(id));
  if (deletable.length > 0) {
    await tx.documentVersion.deleteMany({
      where: { id: { in: deletable } },
    });
  }
}

/**
 * Create a new DocumentVersion for a page.
 *
 * Concurrency: the next version number is a lock-free "read latest, insert
 * latest+1", which can race a concurrent writer (e.g. machine sync) on
 * @@unique([pageId, version]). We wrap the read+insert+prune in a transaction
 * and retry ONCE on the resulting P2002 (recomputing the next version), so a
 * race never silently loses a snapshot.
 */
export async function createDocumentVersion(options: CreateVersionOptions) {
  const {
    pageId,
    tenantId,
    content,
    plainText,
    changeType,
    changeSource,
    changeNotes,
  } = options;

  const insertOnce = () =>
    prisma.$transaction(async (tx) => {
      const latest = await tx.documentVersion.findFirst({
        where: { pageId, tenantId },
        orderBy: { version: "desc" },
        select: { version: true, plainText: true },
      });

      const nextVersion = (latest?.version ?? 0) + 1;

      let diffFromPrev: Prisma.InputJsonValue | undefined;
      if (latest) {
        const diff = computeTextDiff(latest.plainText, plainText);
        diffFromPrev = JSON.parse(
          JSON.stringify(diff)
        ) as Prisma.InputJsonValue;
      }

      const created = await tx.documentVersion.create({
        data: {
          pageId,
          tenantId,
          version: nextVersion,
          content,
          plainText,
          changeType,
          changeSource: changeSource ?? null,
          changeNotes: changeNotes ?? null,
          diffFromPrev: diffFromPrev ?? undefined,
        },
      });

      await pruneOldVersions(tx, pageId, tenantId);
      return created;
    });

  try {
    return await insertOnce();
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Raced another writer on @@unique([pageId, version]); recompute the next
      // version inside a fresh transaction and retry once.
      return await insertOnce();
    }
    throw err;
  }
}

interface SnapshotOnSaveOptions {
  pageId: string;
  tenantId: string;
  /** The content that was just saved. */
  content: Prisma.InputJsonValue;
  /** PlainText DERIVED FROM the saved content (block.plainText is stale). */
  plainText: string;
  userId: string;
  /** Content that existed before this save — used for the first-edit baseline. */
  previousContent?: Prisma.InputJsonValue | null;
  /** PlainText derived from previousContent. */
  previousPlainText?: string;
}

/**
 * Snapshot a page version after a user save, coalesced and race-safe.
 *
 * - First edit (no versions yet): snapshot the PREVIOUS content as the baseline
 *   (v1 = pre-edit state) before recording the new content, so history always
 *   has a point to diff against.
 * - Coalescing: if the latest version is a MANUAL edit by the SAME user within
 *   the coalescing window, skip — UNLESS the plainText word-delta is large.
 * - No-op when the saved content is textually identical to the latest version.
 *
 * Intended to be called fire-and-forget from the save route; it must never
 * throw into the caller (the route logs and ignores rejections).
 */
export async function snapshotOnSave(
  options: SnapshotOnSaveOptions
): Promise<void> {
  const {
    pageId,
    tenantId,
    content,
    plainText,
    userId,
    previousContent,
    previousPlainText,
  } = options;

  const latest = await prisma.documentVersion.findFirst({
    where: { pageId, tenantId },
    orderBy: { version: "desc" },
    select: {
      version: true,
      plainText: true,
      changeType: true,
      changeSource: true,
      createdAt: true,
    },
  });

  // First-edit baseline: capture the pre-edit content as v1 before the new one.
  if (!latest) {
    if (
      previousContent !== undefined &&
      previousContent !== null &&
      (previousPlainText ?? "").length > 0
    ) {
      await createDocumentVersion({
        pageId,
        tenantId,
        content: previousContent,
        plainText: previousPlainText ?? "",
        changeType: "MANUAL",
        changeSource: userId,
        changeNotes: "Baseline before first edit",
      });
    }
    await createDocumentVersion({
      pageId,
      tenantId,
      content,
      plainText,
      changeType: "MANUAL",
      changeSource: userId,
    });
    return;
  }

  // Nothing changed textually → don't record a redundant version.
  if (latest.plainText === plainText) return;

  const diff = computeTextDiff(latest.plainText, plainText);
  const wordsChanged = diff.additions + diff.deletions;
  const isLargeDelta = wordsChanged >= LARGE_DELTA_WORDS;
  const withinWindow =
    Date.now() - latest.createdAt.getTime() < COALESCE_WINDOW_MS;
  const sameUser =
    latest.changeType === "MANUAL" && latest.changeSource === userId;

  // Coalesce rapid same-user edits into the existing snapshot.
  if (withinWindow && sameUser && !isLargeDelta) return;

  await createDocumentVersion({
    pageId,
    tenantId,
    content,
    plainText,
    changeType: "MANUAL",
    changeSource: userId,
  });
}

export async function listDocumentVersions(
  pageId: string,
  tenantId: string,
  limit: number = 50,
  offset: number = 0
) {
  const where = { pageId, tenantId };

  const [versions, total] = await Promise.all([
    prisma.documentVersion.findMany({
      where,
      select: {
        id: true,
        version: true,
        changeType: true,
        changeSource: true,
        changeNotes: true,
        createdAt: true,
        plainText: true,
      },
      orderBy: { version: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.documentVersion.count({ where }),
  ]);

  return {
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      change_type: v.changeType,
      change_source: v.changeSource,
      change_notes: v.changeNotes,
      created_at: v.createdAt.toISOString(),
      word_count: v.plainText.split(/\s+/).filter(Boolean).length,
    })),
    total,
  };
}

export async function getDocumentVersion(
  pageId: string,
  tenantId: string,
  version: number
) {
  return prisma.documentVersion.findFirst({
    where: { pageId, tenantId, version },
  });
}

/** Raised inside the restore transaction when the block version moved under us. */
class RestoreVersionConflict extends Error {
  constructor() {
    super("Block version changed during restore");
    this.name = "RestoreVersionConflict";
  }
}

export interface RestoreResult {
  snapshot: Awaited<ReturnType<typeof createDocumentVersion>>;
  /** The Block.version AFTER the in-place restore write (editor concurrency token). */
  blockVersion: number;
}

/**
 * Restore a page to a historical version.
 *
 * Writes the version's content back to the SAME DOCUMENT block in place
 * (content update + Block.version increment) — deliberately NOT via
 * savePageBlocks, which deleteMany's + recreates blocks (resetting version and
 * minting a new block.id, which would break every open editor's concurrency
 * token and orphan the search index). The write is version-checked against the
 * block version read in the same transaction, with a bounded retry so a save
 * landing mid-restore retries rather than blindly clobbers. It then fans out the
 * same side effects as a normal save (links + search + filesystem mirror) and
 * records the restore as a new history snapshot.
 */
export async function restoreDocumentVersion(
  pageId: string,
  tenantId: string,
  version: number,
  userId: string
): Promise<RestoreResult | null> {
  const target = await getDocumentVersion(pageId, tenantId, version);
  if (!target) return null;

  const content = target.content as Prisma.InputJsonValue;
  const plainText = target.plainText;

  const MAX_RETRIES = 2;
  let restored: { blockId: string; blockVersion: number } | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const block = await prisma.block.findFirst({
      where: { pageId, tenantId, type: "DOCUMENT" },
      select: { id: true, version: true },
    });
    // No DOCUMENT block to restore into — nothing to write back.
    if (!block) return null;

    try {
      restored = await prisma.$transaction(async (tx) => {
        // Conditional, version-checked update: only writes when the row still
        // has the version we just read, so a concurrent save is detected.
        const result = await tx.block.updateMany({
          where: { id: block.id, tenantId, version: block.version },
          data: { content, version: { increment: 1 } },
        });
        if (result.count === 0) {
          throw new RestoreVersionConflict();
        }
        return { blockId: block.id, blockVersion: block.version + 1 };
      });
      break;
    } catch (err) {
      if (err instanceof RestoreVersionConflict && attempt < MAX_RETRIES) {
        // Re-read the block version and retry — the user's explicit revert wins.
        continue;
      }
      throw err;
    }
  }

  if (!restored) {
    throw new Error(
      "Restore failed: the page was being modified concurrently. Try again."
    );
  }

  const tiptap = content as unknown as TipTapDocument;

  // Reproduce the blocks-PUT fan-out so links/search/mirror reflect the restore.
  await updatePageLinks(pageId, tenantId, [tiptap]);
  await updateSearchIndex(restored.blockId, tiptap);
  syncPageToFilesystem(tenantId, pageId).catch((err) =>
    console.error("Sync after restore failed:", err)
  );

  // Record the restore itself as a new history snapshot.
  const snapshot = await createDocumentVersion({
    pageId,
    tenantId,
    content,
    plainText,
    changeType: "MANUAL",
    changeSource: userId,
    changeNotes: `Restored from version ${version}`,
  });

  return { snapshot, blockVersion: restored.blockVersion };
}

export async function compareDocumentVersions(
  pageId: string,
  tenantId: string,
  v1: number,
  v2: number
) {
  const [version1, version2] = await Promise.all([
    getDocumentVersion(pageId, tenantId, v1),
    getDocumentVersion(pageId, tenantId, v2),
  ]);

  if (!version1 || !version2) return null;

  const diff = computeTextDiff(version1.plainText, version2.plainText);

  return {
    v1: { version: v1, created_at: version1.createdAt.toISOString() },
    v2: { version: v2, created_at: version2.createdAt.toISOString() },
    diff,
  };
}
