"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/SupabaseProvider";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { WorkspaceAvatar } from "./WorkspaceAvatar";
import { WorkspaceCreateDialog } from "./WorkspaceCreateDialog";
import "./workspace-dropdown.css";

export function WorkspaceDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const user = useUser();
  const {
    workspaces,
    isLoading,
    createWorkspace,
    isCreating,
    switchWorkspace,
    isSwitching,
  } = useWorkspaces();

  const activeWorkspace = workspaces.find((w) => w.isCurrent);
  const workspaceName = activeWorkspace?.name ?? "Workspace";

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Keyboard navigation within the dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (!isOpen || !panelRef.current) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>("[role='menuitem']")
        );
        const current = items.findIndex((el) => el === document.activeElement);
        const next =
          e.key === "ArrowDown"
            ? Math.min(current + 1, items.length - 1)
            : Math.max(current - 1, 0);
        items[next]?.focus();
      }
    },
    [isOpen]
  );

  const handleSettings = useCallback(() => {
    setIsOpen(false);
    router.push("/settings");
  }, [router]);

  const handleLogout = useCallback(async () => {
    setIsOpen(false);
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }, [router]);

  const handleNewWorkspace = useCallback(() => {
    setIsOpen(false);
    setShowCreateDialog(true);
  }, []);

  const handleCreateWorkspace = useCallback(
    (name: string) => {
      createWorkspace(name);
    },
    [createWorkspace]
  );

  const handleSwitchWorkspace = useCallback(
    (id: string) => {
      if (activeWorkspace?.id === id) return;
      setIsOpen(false);
      switchWorkspace(id);
    },
    [activeWorkspace, switchWorkspace]
  );

  const userEmail = user?.email ?? "user@example.com";
  const memberCount = activeWorkspace?.memberCount ?? 1;
  const plan = activeWorkspace?.plan ?? "Free Plan";

  return (
    <>
      <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
        {/* Trigger */}
        <button
          ref={triggerRef}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm font-semibold
            text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors w-full
            ${isOpen ? "bg-[var(--sidebar-hover)]" : ""}`}
          aria-label="Workspace menu"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <WorkspaceAvatar name={workspaceName} size="sm" />
          <span className="flex-1 text-left truncate">{workspaceName}</span>
          <svg
            className={`w-4 h-4 text-[var(--sidebar-text-secondary)] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div
            ref={panelRef}
            className="ws-dropdown-panel"
            role="menu"
            aria-label="Workspace options"
          >
            {/* Section 1: Workspace Header */}
            <div className="ws-dropdown-section" role="group" aria-label="Workspace settings">
              <div className="flex items-start gap-3">
                <WorkspaceAvatar name={workspaceName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {workspaceName}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {plan} &middot; {memberCount} {memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 mt-3">
                <button
                  onClick={handleSettings}
                  role="menuitem"
                  className="ws-header-button"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={() => {
                    // Placeholder — will open InviteMembersDialog in SKB-23.3
                  }}
                  role="menuitem"
                  className="ws-header-button"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                  Invite
                </button>
              </div>
            </div>

            {/* Section 2: Account & Workspaces */}
            <div className="ws-dropdown-section" role="group" aria-label="Workspaces">
              {/* User email */}
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[13px] text-[var(--text-secondary)] truncate">
                  {userEmail}
                </span>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
                  role="menuitem"
                  aria-label="Account options"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
              </div>

              {/* Workspace list */}
              {isLoading ? (
                <div className="px-2 py-3 text-xs text-[var(--text-tertiary)]">
                  Loading...
                </div>
              ) : (
                workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    className="ws-dropdown-item w-full"
                    role="menuitem"
                    aria-current={ws.isCurrent ? "true" : undefined}
                    onClick={() => handleSwitchWorkspace(ws.id)}
                    disabled={isSwitching}
                  >
                    <WorkspaceAvatar name={ws.name} size="sm" />
                    <span className="flex-1 text-left truncate text-[var(--text-primary)]">
                      {ws.name}
                    </span>
                    {ws.isCurrent && (
                      <svg className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))
              )}

              {/* New workspace link */}
              <button
                className="ws-dropdown-item w-full text-[var(--accent-primary)]"
                role="menuitem"
                onClick={handleNewWorkspace}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-left">New workspace</span>
              </button>
            </div>

            {/* Section 3: Actions */}
            <div className="ws-dropdown-section" role="group" aria-label="Account actions">
              <button
                onClick={handleLogout}
                className="ws-dropdown-item w-full"
                role="menuitem"
              >
                <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workspace creation dialog */}
      <WorkspaceCreateDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateWorkspace}
        isCreating={isCreating}
      />
    </>
  );
}
