"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NotificationList } from "@/components/inbox/NotificationList";
import { EmptyState } from "@/components/inbox/EmptyState";
import type { NotificationData } from "@/components/inbox/NotificationItem";

const PAGE_SIZE = 50;

export default function InboxPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchNotifications = useCallback(
    async (append = false) => {
      try {
        const currentOffset = append ? offset : 0;
        const response = await fetch(
          `/api/notifications?limit=${PAGE_SIZE}&offset=${currentOffset}`
        );
        const json = await response.json();

        if (append) {
          setNotifications((prev) => [...prev, ...json.data]);
        } else {
          setNotifications(json.data);
        }

        setHasMore(
          json.meta.total > currentOffset + json.data.length
        );
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        setLoading(false);
      }
    },
    [offset]
  );

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }

    if (notification.page_id) {
      router.push(`/pages/${notification.page_id}`);
    }
  };

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchNotifications(true);
  };

  if (loading) {
    return (
      <div className="w-full content-pad py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full content-pad py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Notifications
        </h1>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <NotificationList
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
          />

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
