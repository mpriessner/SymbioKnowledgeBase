"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";
import { SidebarTeamspaceSection } from "@/components/workspace/SidebarTeamspaceSection";
import { usePageTree } from "@/hooks/usePageTree";
import { useCreatePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { useTeamspaces } from "@/hooks/useTeamspaces";
import { useIsMac } from "@/hooks/useClientValue";
import type { PageTreeNode } from "@/types/page";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, error } = usePageTree();
  const createPage = useCreatePage();
  const { recentPages } = useRecentPages();
  const { isCollapsed, toggle: toggleSidebar } = useSidebarCollapse();
  const { width: sidebarWidth, isResizing, startResize } = useSidebarWidth();
  const { data: teamspaces } = useTeamspaces();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const isMac = useIsMac();
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Close create menu on outside click
  useEffect(() => {
    if (!showCreateMenu) return;
    function handleClick(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCreateMenu]);

  const handleNewPage = useCallback(() => {
    setShowCreateMenu(false);
    createPage.mutate(
      { title: "Untitled" },
      {
        onSuccess: (data) => {
          router.push(`/pages/${data.data.id}`);
        },
      }
    );
  }, [createPage, router]);

  const handleNewDatabase = useCallback(() => {
    setShowCreateMenu(false);
    router.push("/databases");
  }, [router]);

  const handleSearch = useCallback(() => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, []);

  // Collapsed sidebar: narrow strip with toggle button
  if (isCollapsed) {
    return (
      <aside className="w-10 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--sidebar-bg)] flex flex-col items-center py-2">
        <button
          onClick={toggleSidebar}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <svg
            className="w-4 h-4 text-[var(--sidebar-text-secondary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  const isActive = (path: string) => pathname === path;

  return (
      <aside
        className="relative flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--sidebar-bg)] flex flex-col h-full overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handle */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50 transition-colors ${
            isResizing
              ? "bg-[var(--accent-primary)]"
              : "hover:bg-[var(--border-default)]"
          }`}
          onMouseDown={startResize}
          style={{ touchAction: "none" }}
        >
          {/* Invisible wider hit area */}
          <div className="absolute -left-1 -right-1 top-0 bottom-0" />
        </div>
        {/* Workspace Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-[var(--border-default)]">
          <div className="flex-1 min-w-0">
            <WorkspaceDropdown />
          </div>
          <div className="flex items-center gap-0.5 ml-1">
            {/* Collapse sidebar */}
            <button
              onClick={toggleSidebar}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <svg className="w-4 h-4 text-[var(--sidebar-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            {/* New page dropdown */}
            <div ref={createMenuRef} className="relative">
              <button
                onClick={() => setShowCreateMenu((prev) => !prev)}
                disabled={createPage.isPending}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors disabled:opacity-50"
                aria-label="Create new"
                title="Create new"
              >
                <svg className="w-4 h-4 text-[var(--sidebar-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>

              {showCreateMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
                  <button
                    onClick={handleNewPage}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Page
                  </button>
                  <button
                    onClick={handleNewDatabase}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
                    </svg>
                    Database
                  </button>
                  <button
                    onClick={handleNewPage}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                    AI Meeting Notes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Navigation Links */}
        <div className="flex-shrink-0 px-2 py-1 border-b border-[var(--border-default)]">
          <button
            onClick={handleSearch}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[10px] text-[var(--sidebar-text-secondary)] opacity-60 px-1 py-0.5 border border-[var(--border-default)] rounded">
              {isMac ? "\u2318" : "Ctrl+"}K
            </kbd>
          </button>

          <button
            onClick={() => router.push("/home")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              isActive("/home")
                ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-medium"
                : "text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span>Home</span>
          </button>

          <button
            onClick={() => router.push("/graph")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              isActive("/graph")
                ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-medium"
                : "text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span>Graph</span>
          </button>
        </div>

        {/* Sidebar Content - Page Tree */}
        <div className="flex-1 overflow-y-auto">
          {/* Recents section */}
          {recentPages.length > 0 && (
            <div className="px-2 pt-3 pb-1">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sidebar-text-secondary)]">
                Recents
              </span>
              <div className="mt-1 space-y-0.5">
                {recentPages.slice(0, 5).map((page) => (
                  <button
                    key={page.id}
                    onClick={() => router.push(`/pages/${page.id}`)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)] transition-colors truncate"
                  >
                    <span className="text-xs flex-shrink-0">{page.icon || "\u{1F4C4}"}</span>
                    <span className="truncate">{page.title || "Untitled"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Private pages section */}
          <SidebarTeamspaceSection
            sectionId="private"
            label="Private"
            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
            isLoading={isLoading}
            error={error}
            tree={data ? data.data.filter((n: PageTreeNode) => !n.teamspaceId && n.spaceType !== "AGENT") : []}
          />

          {/* Teamspace sections */}
          {/* TODO: The logic for sharing different pages in the teams section
              needs to be defined later. Currently displays teamspace pages as
              read-only for all members. Future work includes: role-based access
              control, invite flows, and cross-team page sharing. */}
          {teamspaces?.map((ts) => (
            <SidebarTeamspaceSection
              key={ts.id}
              sectionId={ts.id}
              label={ts.name}
              icon={ts.icon ? <span className="text-sm">{ts.icon}</span> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>}
              badge={`${ts.member_count}`}
              isLoading={isLoading}
              error={null}
              tree={data ? data.data.filter((n: PageTreeNode) => n.teamspaceId === ts.id) : []}
            />
          ))}

          {/* Agent Knowledge Base section */}
          <SidebarTeamspaceSection
            sectionId="agent"
            label="Agent"
            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>}
            isLoading={isLoading}
            error={error}
            tree={data ? data.data.filter((n: PageTreeNode) => n.spaceType === "AGENT") : []}
          />
        </div>

      </aside>
  );
}
