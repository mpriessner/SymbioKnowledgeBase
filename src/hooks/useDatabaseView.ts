"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DatabaseViewType, ViewConfig } from "@/types/database";

interface UseDatabaseViewOptions {
  databaseId: string;
  initialView?: DatabaseViewType;
  initialViewConfig?: ViewConfig | null;
}

export function useDatabaseView({
  databaseId,
  initialView = "table",
  initialViewConfig = null,
}: UseDatabaseViewOptions) {
  const queryClient = useQueryClient();
  const [activeView, setActiveViewState] = useState<DatabaseViewType>(initialView);
  const [viewConfig, setViewConfigState] = useState<ViewConfig>(
    (initialViewConfig as ViewConfig) ?? {}
  );

  const patchMutation = useMutation({
    mutationFn: async (data: {
      defaultView?: DatabaseViewType;
      viewConfig?: ViewConfig;
    }) => {
      const res = await fetch(`/api/databases/${databaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update database view config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["databases", databaseId] });
    },
  });

  const setActiveView = useCallback(
    (view: DatabaseViewType) => {
      setActiveViewState(view);
      patchMutation.mutate({ defaultView: view });
    },
    [patchMutation]
  );

  const updateViewConfig = useCallback(
    (config: Partial<ViewConfig>) => {
      setViewConfigState((prev) => {
        const merged = { ...prev, ...config };
        patchMutation.mutate({ viewConfig: merged });
        return merged;
      });
    },
    [patchMutation]
  );

  return {
    activeView,
    setActiveView,
    viewConfig,
    updateViewConfig,
  };
}
