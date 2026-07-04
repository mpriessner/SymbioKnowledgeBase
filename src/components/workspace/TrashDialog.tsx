"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { pageKeys } from "@/hooks/usePages";

interface TrashItem {
  id: string;
  title: string;
  icon: string | null;
  deletedAt: string | null;
  parentTitle: string | null;
}

interface TrashDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Trash panel: lists the tenant's soft-deleted pages with per-item Restore and
 * Delete-forever (confirmed) actions. Restoring or purging invalidates the page
 * tree so the sidebar reflects the change immediately.
 */
export function TrashDialog({ isOpen, onClose }: TrashDialogProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pages/trash");
      if (!res.ok) throw new Error("Failed to load Trash");
      const body = await res.json();
      setItems((body.data ?? []) as TrashItem[]);
    } catch {
      setError("Could not load Trash. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
      setConfirmPurgeId(null);
    }
  }, [isOpen, load]);

  const invalidateTree = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
  }, [queryClient]);

  const handleRestore = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/pages/${id}/trash-restore`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Restore failed");
        setItems((prev) => prev.filter((i) => i.id !== id));
        invalidateTree();
      } catch {
        setError("Could not restore that page. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [invalidateTree]
  );

  const handlePurge = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/pages/${id}/trash-purge`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
        setItems((prev) => prev.filter((i) => i.id !== id));
        setConfirmPurgeId(null);
        invalidateTree();
        // If the purged page is open, navigate away from the dead route.
        if (pathname === `/pages/${id}`) {
          router.push("/home");
        }
      } catch {
        setError("Could not delete that page. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [invalidateTree, pathname, router]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trash">
      <div className="min-h-[8rem]">
        {isLoading ? (
          <p className="text-sm text-[var(--text-secondary)] py-6 text-center">
            Loading…
          </p>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--danger)] mb-2">{error}</p>
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <Trash2 className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)] opacity-50" />
            <p className="text-sm text-[var(--text-secondary)]">
              Trash is empty. Deleted pages will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--bg-secondary)]"
              >
                <span className="text-sm flex-shrink-0">
                  {item.icon || "\u{1F4C4}"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--text-primary)] font-medium">
                    {item.title || "Untitled"}
                  </p>
                  {item.parentTitle && (
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      in {item.parentTitle}
                    </p>
                  )}
                </div>

                {confirmPurgeId === item.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busyId === item.id}
                      onClick={() => handlePurge(item.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmPurgeId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(item.id)}
                      disabled={busyId === item.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                      title="Restore page"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => setConfirmPurgeId(item.id)}
                      disabled={busyId === item.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--danger)]/10 text-[var(--danger)] transition-colors disabled:opacity-50"
                      title="Delete forever"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete forever</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
