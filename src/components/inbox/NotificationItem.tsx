"use client";

import { formatDistanceToNow } from "date-fns";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  page_id?: string | null;
  source_user_name?: string | null;
  read: boolean;
  created_at: string;
}

interface NotificationItemProps {
  notification: NotificationData;
  onClick: () => void;
}

function getIcon(type: string): string {
  switch (type) {
    case "PAGE_MENTION":
      return "\u{1F4DD}";
    case "PAGE_UPDATE":
      return "\u{1F514}";
    case "AGENT_CREATED":
      return "\u{1F916}";
    case "SYSTEM":
      return "\u{1F514}";
    default:
      return "\u{1F4EC}";
  }
}

export type { NotificationData };

export function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const timestamp = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-lg cursor-pointer transition-colors
        ${
          notification.read
            ? "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
            : "bg-[var(--accent-primary)]/10 border-l-4 border-[var(--accent-primary)]"
        }
        hover:bg-[var(--bg-hover)]
      `}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{getIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm text-[var(--text-primary)] ${
              notification.read ? "" : "font-semibold"
            }`}
          >
            {notification.title}
          </p>
          {notification.body && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            {timestamp}
          </p>
        </div>
      </div>
    </button>
  );
}
