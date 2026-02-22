"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DndSidebarTree } from "@/components/workspace/DndSidebarTree";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";
import { SettingsModal } from "@/components/workspace/SettingsModal";
import { usePageTree } from "@/hooks/usePageTree";
import { useCreatePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import { useUnreadCount } from "@/hooks/useUnreadCount";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, error } = usePageTree();
  const createPage = useCreatePage();
  const { recentPages } = useRecentPages();
  const { isCollapsed, toggle: toggleSidebar } = useSidebarCollapse();
  const { unreadCount } = useUnreadCount();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Detect platform after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMac(navigator.platform?.includes("Mac") ?? false);
  }, []);

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
    window.dispatchEvent(event);
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
    <>
      <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--sidebar-bg)] flex flex-col h-full overflow-hidden">
        {/* Workspace Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-[var(--border-default)]">
          <div className="flex-1 min-w-0">
            <WorkspaceDropdown onOpenSettings={() => setIsSettingsOpen(true)} />
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

          <button
            onClick={() => router.push("/inbox")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              isActive("/inbox")
                ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-medium"
                : "text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
            <span className="flex-1 text-left">Inbox</span>
            {unreadCount > 0 && (
              <span
                className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
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
                    <span className="text-xs flex-shrink-0">{page.icon || "📄"}</span>
                    <span className="truncate">{page.title || "Untitled"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Private pages section */}
          <div className="px-2 pt-3 pb-1">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sidebar-text-secondary)]">
              Private
            </span>
          </div>

          {isLoading && (
            <div className="px-3 py-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 animate-pulse">
                  <div className="w-4 h-4 bg-[var(--bg-tertiary)] rounded" />
                  <div
                    className="h-3 bg-[var(--bg-tertiary)] rounded"
                    style={{ width: `${60 + i * 20}px` }}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-4">
              <p className="text-sm text-[var(--danger)]">Failed to load pages</p>
              <p className="text-xs text-[var(--danger)] mt-1 opacity-75">{error.message}</p>
            </div>
          )}

          {data && <DndSidebarTree tree={data.data} />}
        </div>

        {/* Sidebar Footer */}
        <div className="flex-shrink-0 border-t border-[var(--border-default)] bg-[var(--sidebar-bg)] px-3 py-2.5 flex items-center justify-between relative z-50">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm">Settings</span>
          </button>
        </div>
      </aside>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
