"use client";

import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { PageCreationMenu } from "@/components/page/PageCreationMenu";
import { DatabaseViewContainer } from "@/components/database/DatabaseViewContainer";
import { ErrorBoundary, EditorErrorFallback } from "@/components/ErrorBoundary";
import { usePageBlocks } from "@/hooks/useBlockEditor";
import type { DatabaseSchema, DatabaseViewType, ViewConfig } from "@/types/database";

interface PageContentProps {
  pageId: string;
  onEditorReady?: (editor: Editor) => void;
}

interface DatabaseForPage {
  id: string;
  pageId: string;
  schema: DatabaseSchema;
  defaultView: string;
  viewConfig: ViewConfig | null;
}

interface DatabaseListResponse {
  data: DatabaseForPage[];
  meta: { total: number };
}

export function PageContent({ pageId, onEditorReady }: PageContentProps) {
  const queryClient = useQueryClient();

  // Track the live editor instance so the error-boundary fallback can offer a
  // copy-to-clipboard escape hatch for unsaved content if the editor crashes.
  const editorRef = useRef<Editor | null>(null);
  const handleEditorReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      onEditorReady?.(editor);
    },
    [onEditorReady]
  );

  // Render the editor with a per-page `key` so client-side navigation
  // A → B fully remounts it. Without the key the editor instance (and its
  // in-memory document) is reused across pages, while autosave retargets the
  // new pageId — so page A's content gets written into page B. The error
  // boundary keeps an editor crash from white-screening the page and lets the
  // user rescue unsaved work.
  const renderEditor = () => (
    <ErrorBoundary
      key={pageId}
      fallback={(error, reset) => (
        <EditorErrorFallback
          error={error}
          reset={reset}
          getContent={() =>
            editorRef.current && !editorRef.current.isDestroyed
              ? editorRef.current.getJSON()
              : null
          }
        />
      )}
    >
      <BlockEditor key={pageId} pageId={pageId} onEditorReady={handleEditorReady} />
    </ErrorBoundary>
  );

  // Fetch blocks for this page
  const { data: blocks, isLoading: blocksLoading } = usePageBlocks(pageId);

  // Fetch database for this page (if any)
  const { data: dbData, isLoading: dbLoading } =
    useQuery<DatabaseListResponse>({
      queryKey: ["databases", "byPage", pageId],
      queryFn: async () => {
        const res = await fetch(`/api/databases?pageId=${pageId}`);
        if (!res.ok) throw new Error("Failed to fetch databases");
        return res.json() as Promise<DatabaseListResponse>;
      },
    });

  const handleCreationAction = useCallback(() => {
    // Refetch both blocks and databases
    queryClient.invalidateQueries({ queryKey: ["blocks", "page", pageId] });
    queryClient.invalidateQueries({ queryKey: ["databases", "byPage", pageId] });
  }, [queryClient, pageId]);

  if (blocksLoading || dbLoading) {
    return null; // Parent already shows loading state; let BlockEditor handle its own loading
  }

  // Check if the page has a database
  const database = dbData?.data?.[0];
  if (database) {
    return (
      <>
        <div className="w-full content-pad">
          <DatabaseViewContainer
            databaseId={database.id}
            schema={database.schema}
            defaultView={database.defaultView as DatabaseViewType}
            viewConfig={database.viewConfig}
          />
        </div>
        {/* Also show editor below database for additional page content */}
        <div className="w-full">{renderEditor()}</div>
      </>
    );
  }

  // Check if page is empty (no blocks, or only an empty DOCUMENT block)
  const isEmptyPage = !blocks || blocks.length === 0 || isDocumentEmpty(blocks);

  return (
    <>
      {isEmptyPage && (
        <PageCreationMenu pageId={pageId} onAction={handleCreationAction} />
      )}
      <div className="w-full">{renderEditor()}</div>
    </>
  );
}

/**
 * Check if the page's blocks represent an empty document.
 */
function isDocumentEmpty(blocks: Array<{ type: string; content: unknown }>): boolean {
  if (blocks.length === 0) return true;

  const docBlock = blocks.find((b) => b.type === "DOCUMENT");
  if (!docBlock) return true;

  const content = docBlock.content as { content?: Array<{ type: string; content?: unknown }> } | null;
  if (!content || !content.content) return true;

  // Empty if just one empty paragraph
  if (
    content.content.length === 1 &&
    content.content[0].type === "paragraph" &&
    !content.content[0].content
  ) {
    return true;
  }

  return false;
}
