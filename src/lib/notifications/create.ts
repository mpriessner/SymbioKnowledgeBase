import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";

interface CreateNotificationOptions {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  pageId?: string;
  sourceUserId?: string;
}

export async function createNotification(
  options: CreateNotificationOptions
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body,
        pageId: options.pageId,
        sourceUserId: options.sourceUserId,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
    // Don't throw — notification failures shouldn't block primary operations
  }
}
