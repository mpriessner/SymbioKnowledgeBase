import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { MIRROR_ROOT } from "./config";
import { buildPagePaths, absolutePath } from "./FolderStructure";
import type { SyncPageData } from "./types";

/**
 * Get the assets directory for a page.
 * Assets are stored in: tenant/PageTitle/assets/
 */
export function getAssetsDir(
  tenantId: string,
  pageDirPath: string
): string {
  return path.join(MIRROR_ROOT, tenantId, pageDirPath, "assets");
}

/**
 * Store an attachment file in the page's assets directory
 * and create a FileAttachment record in the database.
 *
 * Returns the relative path for use in markdown (e.g., "./PageTitle/assets/image.png")
 */
export async function storeAttachment(
  tenantId: string,
  pageId: string,
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ relativePath: string; attachmentId: string }> {
  // Get all pages to build folder structure
  const allPages = await prisma.page.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      position: true,
      spaceType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const syncPages: SyncPageData[] = allPages.map((p) => ({
    ...p,
    blocks: [],
  }));

  const pathMap = buildPagePaths(syncPages);
  const resolved = pathMap.get(pageId);
  if (!resolved) {
    throw new Error(`Page ${pageId} not found in folder structure`);
  }

  // Create the assets directory
  const assetsDir = getAssetsDir(tenantId, resolved.dirPath);
  await fs.mkdir(assetsDir, { recursive: true });

  // Sanitize filename
  const safeName = sanitizeFileName(fileName);

  // Write file to disk
  const filePath = path.join(assetsDir, safeName);
  await fs.writeFile(filePath, fileBuffer);

  // Compute checksum
  const checksum = crypto
    .createHash("md5")
    .update(fileBuffer)
    .digest("hex");

  // Storage path relative to mirror root
  const storagePath = path.relative(MIRROR_ROOT, filePath);

  // Create FileAttachment record
  const attachment = await prisma.fileAttachment.create({
    data: {
      tenantId,
      userId,
      pageId,
      fileName: safeName,
      fileSize: BigInt(fileBuffer.length),
      mimeType,
      storagePath,
      status: "READY",
      checksum,
    },
  });

  // Build relative path for markdown reference
  // From the .md file's perspective: ./DirPath/assets/filename
  const relativePath = `./${resolved.dirPath}/assets/${safeName}`;

  return { relativePath, attachmentId: attachment.id };
}

/**
 * Adjust a tenant's `storageUsed` counter by a signed byte delta.
 *
 * This is the SINGLE owner of `storageUsed` mutations — every attachment
 * create/delete path (upload here, trash-purge, future GC) must route through
 * it so the counter cannot drift. Uses Prisma's atomic `{ increment }` so
 * concurrent uploads/deletes compose correctly; pass a negative delta to
 * decrement. Values are BigInt to match the schema's BigInt columns.
 */
export async function adjustStorageUsed(
  tenantId: string,
  deltaBytes: bigint
): Promise<void> {
  if (deltaBytes === BigInt(0)) return;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { storageUsed: { increment: deltaBytes } },
  });
}

/**
 * Decide whether adding `addBytes` would push a tenant over its quota.
 *
 * All arithmetic is BigInt so it stays exact for multi-gigabyte quotas that
 * exceed Number.MAX_SAFE_INTEGER.
 */
export function wouldExceedQuota(
  storageUsed: bigint,
  storageQuota: bigint,
  addBytes: bigint
): boolean {
  return storageUsed + addBytes > storageQuota;
}

/**
 * List attachments for a page.
 */
export async function listAttachments(
  tenantId: string,
  pageId: string
): Promise<
  Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    relativePath: string;
  }>
> {
  const attachments = await prisma.fileAttachment.findMany({
    where: { tenantId, pageId, status: "READY" },
    orderBy: { createdAt: "desc" },
  });

  return attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    fileSize: Number(a.fileSize),
    relativePath: `./${a.storagePath.split("/").slice(1).join("/")}`,
  }));
}

/**
 * Sanitize a filename for safe filesystem storage.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 200);
}

/**
 * Update relative paths in markdown content when a page is moved.
 * This rewrites image/link references that point to the old assets path.
 */
export function rewriteAssetPaths(
  markdown: string,
  oldDirPath: string,
  newDirPath: string
): string {
  const oldPrefix = `./${oldDirPath}/assets/`;
  const newPrefix = `./${newDirPath}/assets/`;

  return markdown.replaceAll(oldPrefix, newPrefix);
}
