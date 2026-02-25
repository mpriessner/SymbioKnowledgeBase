"use client";

import { ViewSwitcher } from "./ViewSwitcher";
import { TableView } from "./TableView";
import { BoardView } from "./BoardView";
import { useDatabaseView } from "@/hooks/useDatabaseView";
import type {
  DatabaseSchema,
  DatabaseViewType,
  ViewConfig,
} from "@/types/database";

interface DatabaseViewContainerProps {
  databaseId: string;
  schema: DatabaseSchema;
  defaultView?: DatabaseViewType;
  viewConfig?: ViewConfig | null;
}

function ViewPlaceholder({ viewType }: { viewType: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-[var(--text-secondary)]">
      <div className="text-center">
        <p className="font-medium capitalize">{viewType} View</p>
        <p className="mt-1 text-[var(--text-tertiary)]">Coming soon</p>
      </div>
    </div>
  );
}

export function DatabaseViewContainer({
  databaseId,
  schema,
  defaultView = "table",
  viewConfig: initialViewConfig = null,
}: DatabaseViewContainerProps) {
  const { activeView, setActiveView, viewConfig, updateViewConfig } =
    useDatabaseView({
      databaseId,
      initialView: defaultView,
      initialViewConfig: initialViewConfig,
    });

  return (
    <div>
      <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
      <div className="mt-2">
        {activeView === "table" && (
          <TableView databaseId={databaseId} schema={schema} />
        )}
        {activeView === "board" && (
          <BoardView
            databaseId={databaseId}
            schema={schema}
            viewConfig={viewConfig}
            onViewConfigChange={updateViewConfig}
          />
        )}
        {activeView === "list" && <ViewPlaceholder viewType="list" />}
        {activeView === "calendar" && <ViewPlaceholder viewType="calendar" />}
        {activeView === "gallery" && <ViewPlaceholder viewType="gallery" />}
        {activeView === "timeline" && <ViewPlaceholder viewType="timeline" />}
      </div>
    </div>
  );
}
