"use client";

import { ViewSwitcher } from "./ViewSwitcher";
import { TableView } from "./TableView";
import { BoardView } from "./BoardView";
import { ListView } from "./ListView";
import { CalendarView } from "./CalendarView";
import { GalleryView } from "./GalleryView";
import { TimelineView } from "./TimelineView";
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
        {activeView === "list" && (
          <ListView
            databaseId={databaseId}
            schema={schema}
            viewConfig={viewConfig}
            onViewConfigChange={updateViewConfig}
          />
        )}
        {activeView === "calendar" && (
          <CalendarView
            databaseId={databaseId}
            schema={schema}
            viewConfig={viewConfig}
            onViewConfigChange={updateViewConfig}
          />
        )}
        {activeView === "gallery" && (
          <GalleryView
            databaseId={databaseId}
            schema={schema}
            viewConfig={viewConfig}
            onViewConfigChange={updateViewConfig}
          />
        )}
        {activeView === "timeline" && (
          <TimelineView
            databaseId={databaseId}
            schema={schema}
            viewConfig={viewConfig}
            onViewConfigChange={updateViewConfig}
          />
        )}
      </div>
    </div>
  );
}
