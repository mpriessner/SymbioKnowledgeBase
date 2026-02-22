"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string | null;
  lastSeen: string;
  isEditing: boolean;
}

async function sendHeartbeat(
  pageId: string,
  isEditing: boolean
): Promise<void> {
  await fetch(`/api/pages/${pageId}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isEditing }),
  });
}

async function fetchPresence(pageId: string): Promise<PresenceUser[]> {
  const res = await fetch(`/api/pages/${pageId}/presence`);
  if (!res.ok) throw new Error("Failed to fetch presence");
  const json = await res.json();
  return json.data;
}

export const presenceKeys = {
  page: (pageId: string) => ["presence", pageId] as const,
};

export function usePresence(pageId: string, isEditing = false) {
  const queryClient = useQueryClient();
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

  const doHeartbeat = useCallback(() => {
    sendHeartbeat(pageId, isEditingRef.current).catch(() => {
      // Silently ignore heartbeat failures
    });
  }, [pageId]);

  // Send heartbeat every 5 seconds
  useEffect(() => {
    doHeartbeat(); // Initial heartbeat
    const interval = setInterval(doHeartbeat, 5000);

    return () => {
      clearInterval(interval);
      // Invalidate presence on unmount so it refreshes elsewhere
      queryClient.invalidateQueries({
        queryKey: presenceKeys.page(pageId),
      });
    };
  }, [pageId, doHeartbeat, queryClient]);

  const { data: activeUsers } = useQuery({
    queryKey: presenceKeys.page(pageId),
    queryFn: () => fetchPresence(pageId),
    refetchInterval: 5000,
    staleTime: 4000,
  });

  return { activeUsers: activeUsers || [] };
}
