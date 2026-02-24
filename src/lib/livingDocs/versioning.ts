import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { computeTextDiff } from "./diff";

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

  const latest = await prisma.documentVersion.findFirst({
    where: { pageId },
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

  return prisma.documentVersion.create({
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

export async function restoreDocumentVersion(
  pageId: string,
  tenantId: string,
  version: number,
  userId: string
) {
  const target = await getDocumentVersion(pageId, tenantId, version);
  if (!target) return null;

  return createDocumentVersion({
    pageId,
    tenantId,
    content: target.content as Prisma.InputJsonValue,
    plainText: target.plainText,
    changeType: "MANUAL",
    changeSource: userId,
    changeNotes: `Restored from version ${version}`,
  });
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
