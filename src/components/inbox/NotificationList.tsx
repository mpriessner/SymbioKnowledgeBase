"use client";

import { NotificationItem } from "./NotificationItem";
import type { NotificationData } from "./NotificationItem";

interface NotificationListProps {
  notifications: NotificationData[];
  onNotificationClick: (notification: NotificationData) => void;
}

function groupByDate(
  notifications: NotificationData[]
): Record<string, NotificationData[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, NotificationData[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };

  for (const notification of notifications) {
    const date = new Date(notification.created_at);
    if (date >= today) {
      groups.Today.push(notification);
    } else if (date >= yesterday) {
      groups.Yesterday.push(notification);
    } else if (date >= weekAgo) {
      groups["This Week"].push(notification);
    } else {
      groups.Older.push(notification);
    }
  }

  return groups;
}

export function NotificationList({
  notifications,
  onNotificationClick,
}: NotificationListProps) {
  const grouped = groupByDate(notifications);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([label, items]) => {
        if (items.length === 0) return null;

        return (
          <div key={label}>
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {label}
            </h2>
            <div className="space-y-2">
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => onNotificationClick(notification)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
