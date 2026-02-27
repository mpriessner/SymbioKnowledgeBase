"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { usePageTree, findPageInTree } from "@/hooks/usePageTree";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { PageActions } from "@/components/workspace/PageHeader";

/**
 * Wrapper that extracts the current page ID from the URL
 * and passes the cached page tree to the Breadcrumbs component.
 *
 * This component reads from the same TanStack Query cache as the Sidebar,
 * so no additional API call is made.
 */
export function BreadcrumbsWrapper() {
  const pathname = usePathname();
  const { data } = usePageTree();

  // Extract page ID from pathname: /pages/[id]
  const pageIdMatch = pathname.match(/^\/pages\/([a-f0-9-]+)/);
  const currentPageId = pageIdMatch?.[1];

  const pageTitle = useMemo(() => {
    if (!currentPageId || !data?.data) return "";
    const node = findPageInTree(data.data, currentPageId);
    return node?.title ?? "";
  }, [currentPageId, data?.data]);

  // Only render breadcrumbs on page view routes
  if (!currentPageId || !data?.data) {
    return null;
  }

  return (
    <Breadcrumbs
      tree={data.data}
      currentPageId={currentPageId}
      actions={<PageActions pageId={currentPageId} pageTitle={pageTitle} />}
    />
  );
}
