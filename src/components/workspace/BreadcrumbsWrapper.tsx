"use client";

import { usePathname } from "next/navigation";
import { usePageTree } from "@/hooks/usePageTree";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";

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

  // Only render breadcrumbs on page view routes
  if (!currentPageId || !data?.data) {
    return null;
  }

  return <Breadcrumbs tree={data.data} currentPageId={currentPageId} />;
}
