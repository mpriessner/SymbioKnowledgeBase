"use client";

import { usePages } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function HomePage() {
  const router = useRouter();
  const { recentPages } = useRecentPages();
  const { data: pagesData, isLoading } = usePages({ sortBy: "updatedAt", order: "desc" });

  const timeOfDay = useMemo(() => getTimeOfDay(), []);
  const allPages = pagesData?.data ?? [];

  const handleNavigateToPage = (pageId: string) => {
    router.push(`/pages/${pageId}`);
  };

  const handleNewPage = () => {
    router.push("/pages");
  };

  const handleSearch = () => {
    // Trigger Cmd+K - the QuickSwitcher component handles this globally
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  const handleViewGraph = () => {
    router.push("/graph");
  };

  return (
    <div className="flex flex-col items-center px-8 py-12 min-h-screen bg-[var(--bg-primary)]">
      {/* Greeting */}
      <div className="w-full max-w-4xl mb-12">
        <h1 className="text-4xl font-semibold text-[var(--text-primary)] mb-2">
          Good {timeOfDay}
        </h1>
      </div>

      {/* Recently Visited */}
      {recentPages.length > 0 && (
        <section className="w-full max-w-4xl mb-12">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
            Recently visited
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {recentPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigateToPage(page.id)}
                className="flex-shrink-0 w-64 p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {page.icon || "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate mb-1 group-hover:text-[var(--accent-primary)] transition-colors">
                      {page.title || "Untitled"}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {getRelativeTime(page.visitedAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="w-full max-w-4xl mb-12">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={handleNewPage}
            className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">✏️</div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  New Page
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Create a blank page
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={handleSearch}
            className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔍</div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  Search
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Press Cmd+K
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={handleViewGraph}
            className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🕸️</div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  View Graph
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  See connections
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* All Pages */}
      <section className="w-full max-w-4xl">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
          All pages
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : allPages.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm">No pages yet. Create your first page to get started!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigateToPage(page.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
              >
                <div className="text-lg flex-shrink-0">
                  {page.icon || "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                    {page.title || "Untitled"}
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
