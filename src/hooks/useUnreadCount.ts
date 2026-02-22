"use client";

import { useState, useEffect } from "react";

const POLL_INTERVAL_MS = 30_000;

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/notifications/unread-count");
        if (response.ok) {
          const json = await response.json();
          setUnreadCount(json.data.count);
        }
      } catch {
        // Silently ignore fetch errors for badge polling
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return { unreadCount };
}
