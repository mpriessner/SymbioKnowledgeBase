import { prisma } from "@/lib/db";
import type { TipTapNode } from "@/lib/wikilinks/types";

interface PageUpdateOptions {
  pageId: string;
  tenantId: string;
  updatedBy: string;
}

/**
 * Trigger PAGE_UPDATE notifications when a user updates a page.
 * Creates one notification per tenant user (excluding the updater).
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function triggerPageUpdateNotifications(
  options: PageUpdateOptions
): Promise<void> {
  try {
    const [page, updater] = await Promise.all([
      prisma.page.findUnique({
        where: { id: options.pageId },
        select: { title: true },
      }),
      prisma.user.findUnique({
        where: { id: options.updatedBy },
        select: { name: true, email: true },
      }),
    ]);

    if (!page) return;

    const updaterName = updater?.name || updater?.email || "Someone";

    const users = await prisma.user.findMany({
      where: {
        tenantId: options.tenantId,
        id: { not: options.updatedBy },
        deactivatedAt: null,
      },
      select: { id: true, tenantId: true },
    });

    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((user) => ({
        tenantId: user.tenantId,
        userId: user.id,
        type: "PAGE_UPDATE" as const,
        title: `${updaterName} updated "${page.title}"`,
        pageId: options.pageId,
        sourceUserId: options.updatedBy,
      })),
    });
  } catch (error) {
    console.error("Failed to trigger page update notifications:", error);
  }
}

/**
 * Extract user IDs from TipTap mention nodes.
 */
function extractMentions(node: TipTapNode): string[] {
  const mentions: string[] = [];

  if (node.type === "mention" && typeof node.attrs?.id === "string") {
    mentions.push(node.attrs.id);
  }

  if (node.content) {
    for (const child of node.content) {
      mentions.push(...extractMentions(child));
    }
  }

  return [...new Set(mentions)];
}

interface PageMentionOptions {
  pageId: string;
  tenantId: string;
  content: TipTapNode;
  authorId: string;
}

/**
 * Trigger PAGE_MENTION notifications for users @-mentioned in TipTap content.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function triggerPageMentionNotifications(
  options: PageMentionOptions
): Promise<void> {
  try {
    const mentionedUserIds = extractMentions(options.content);
    if (mentionedUserIds.length === 0) return;

    const [page, author] = await Promise.all([
      prisma.page.findUnique({
        where: { id: options.pageId },
        select: { title: true },
      }),
      prisma.user.findUnique({
        where: { id: options.authorId },
        select: { name: true, email: true },
      }),
    ]);

    const authorName = author?.name || author?.email || "Someone";

    const users = await prisma.user.findMany({
      where: {
        id: { in: mentionedUserIds },
        tenantId: options.tenantId,
        deactivatedAt: null,
      },
      select: { id: true, tenantId: true },
    });

    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((user) => ({
        tenantId: user.tenantId,
        userId: user.id,
        type: "PAGE_MENTION" as const,
        title: `${authorName} mentioned you in "${page?.title}"`,
        pageId: options.pageId,
        sourceUserId: options.authorId,
      })),
    });
  } catch (error) {
    console.error("Failed to trigger page mention notifications:", error);
  }
}

interface AgentNotificationOptions {
  pageId: string;
  tenantId: string;
  userId: string;
  action: "created" | "updated";
}

/**
 * Trigger AGENT_CREATED notification when an agent creates or updates a page.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function triggerAgentNotification(
  options: AgentNotificationOptions
): Promise<void> {
  try {
    const page = await prisma.page.findUnique({
      where: { id: options.pageId },
      select: { title: true },
    });

    if (!page) return;

    await prisma.notification.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        type: "AGENT_CREATED",
        title: `Agent ${options.action} "${page.title}"`,
        pageId: options.pageId,
      },
    });
  } catch (error) {
    console.error("Failed to trigger agent notification:", error);
  }
}
