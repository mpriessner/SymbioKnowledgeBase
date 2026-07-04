import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { updatePageLinks } from "@/lib/wikilinks/indexer";
import { updateSearchIndexForPage } from "@/lib/search/indexer";
import { syncPageToFilesystem } from "@/lib/sync/SyncService";
import type { TipTapDocument } from "@/lib/wikilinks/types";

/**
 * Maximum number of pages (root + descendants) a single duplicate may clone.
 * Beyond this the caller gets a clear error and NOTHING is persisted — the cap
 * is checked before any write so a huge subtree can never partially clone.
 */
export const DUPLICATE_PAGE_CAP = 200;

export type DuplicatePageResult =
  | { ok: true; rootId: string; pageCount: number; databaseSkipped: boolean }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "CAP_EXCEEDED"; cap: number; count: number };

/**
 * Deep-duplicate a page: clones the page row (title + " (copy)", icon, cover)
 * and ALL of its blocks in position order — plus, by default, its whole subtree.
 *
 * Semantics (v1, see story A70-03):
 * - Placement: the copy appends at the END of its siblings (nextPosition=max+1).
 * - Attachments are SHARED, not cloned: copied blocks keep referencing the
 *   original attachmentIds; no FileAttachment rows are created and storageUsed
 *   is untouched.
 * - Wikilinks are NOT rewritten: links in copies keep pointing at the ORIGINAL
 *   targets (documented limitation).
 * - Attached databases are NOT cloned; `databaseSkipped` reports whether any of
 *   the cloned pages had one so the caller can surface a notice.
 * - All page + block rows are created inside ONE transaction (all-or-nothing);
 *   the per-page index fan-out (links, search, filesystem mirror) runs AFTER
 *   commit, best-effort, so a fan-out failure never rolls back the clone.
 */
export async function duplicatePage(
  tenantId: string,
  pageId: string,
  options: { includeChildren?: boolean } = {}
): Promise<DuplicatePageResult> {
  const includeChildren = options.includeChildren ?? true;

  // 1. Load the root page (tenant-scoped, not trashed). Cross-tenant → NOT_FOUND.
  const root = await prisma.page.findFirst({
    where: { id: pageId, tenantId, deletedAt: null },
  });
  if (!root) return { ok: false, code: "NOT_FOUND" };

  // 2. Determine the ordered set of pages to clone. BFS from the root so a
  //    parent is always created before its children (parentId FK ordering).
  const orderedPageIds: string[] = [root.id];
  if (includeChildren) {
    const all = await prisma.page.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const p of all) {
      if (!p.parentId) continue;
      const siblings = childrenByParent.get(p.parentId) ?? [];
      siblings.push(p.id);
      childrenByParent.set(p.parentId, siblings);
    }
    const queue: string[] = [root.id];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const childId of childrenByParent.get(current) ?? []) {
        orderedPageIds.push(childId);
        queue.push(childId);
      }
    }
  }

  // 3. Enforce the cap BEFORE any write so nothing persists beyond it.
  if (orderedPageIds.length > DUPLICATE_PAGE_CAP) {
    return {
      ok: false,
      code: "CAP_EXCEEDED",
      cap: DUPLICATE_PAGE_CAP,
      count: orderedPageIds.length,
    };
  }

  // 4. Load full page rows + all their blocks (position order).
  const pageRows = await prisma.page.findMany({
    where: { id: { in: orderedPageIds }, tenantId },
  });
  const pageById = new Map(pageRows.map((p) => [p.id, p]));

  const blockRows = await prisma.block.findMany({
    where: { pageId: { in: orderedPageIds }, tenantId, deletedAt: null },
    orderBy: { position: "asc" },
  });
  const blocksByPage = new Map<string, typeof blockRows>();
  for (const b of blockRows) {
    const bucket = blocksByPage.get(b.pageId) ?? [];
    bucket.push(b);
    blocksByPage.set(b.pageId, bucket);
  }

  // 5. Databases are not cloned in v1 — flag if any clone-target has one.
  const databaseCount = await prisma.database.count({
    where: { tenantId, pageId: { in: orderedPageIds } },
  });
  const databaseSkipped = databaseCount > 0;

  // 6. New root appends at the end of its siblings (reuse create-path behavior).
  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId: root.parentId },
    _max: { position: true },
  });
  const rootPosition = (maxPosition._max.position ?? -1) + 1;

  // 7. Clone every page + block inside ONE transaction (all-or-nothing rows).
  const idMap = new Map<string, string>(); // oldPageId -> newPageId
  const newBlockContentsByPageId = new Map<string, TipTapDocument[]>();

  await prisma.$transaction(
    async (tx) => {
      for (const oldId of orderedPageIds) {
        const src = pageById.get(oldId);
        if (!src) continue;
        const isRoot = oldId === root.id;
        const newParentId = isRoot
          ? src.parentId
          : idMap.get(src.parentId as string) ?? null;

        const created = await tx.page.create({
          data: {
            tenantId,
            parentId: newParentId,
            title: isRoot ? `${src.title} (copy)` : src.title,
            icon: src.icon,
            coverUrl: src.coverUrl,
            position: isRoot ? rootPosition : src.position,
            spaceType: src.spaceType,
          },
        });
        idMap.set(oldId, created.id);

        const contents: TipTapDocument[] = [];
        for (const b of blocksByPage.get(oldId) ?? []) {
          await tx.block.create({
            data: {
              pageId: created.id,
              tenantId,
              type: b.type,
              content: b.content as Prisma.InputJsonValue,
              position: b.position,
              plainText: b.plainText,
            },
          });
          contents.push(b.content as unknown as TipTapDocument);
        }
        newBlockContentsByPageId.set(created.id, contents);
      }
    },
    { timeout: 30_000, maxWait: 10_000 }
  );

  const rootId = idMap.get(root.id) as string;

  // 8. Post-commit index fan-out — best-effort, logged; never rolls back rows.
  for (const [newPageId, contents] of newBlockContentsByPageId) {
    try {
      await updatePageLinks(newPageId, tenantId, contents);
    } catch (err) {
      console.error(`duplicatePage: updatePageLinks failed for ${newPageId}`, err);
    }
    try {
      await updateSearchIndexForPage(newPageId, tenantId);
    } catch (err) {
      console.error(`duplicatePage: updateSearchIndex failed for ${newPageId}`, err);
    }
    try {
      await syncPageToFilesystem(tenantId, newPageId);
    } catch (err) {
      console.error(`duplicatePage: syncPageToFilesystem failed for ${newPageId}`, err);
    }
  }

  return { ok: true, rootId, pageCount: orderedPageIds.length, databaseSkipped };
}
