"use client";

import { SidebarTreeNode } from "@/components/workspace/SidebarTreeNode";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import type { PageTreeNode } from "@/types/page";

interface SidebarTreeProps {
  tree: PageTreeNode[];
}

export function SidebarTree({ tree }: SidebarTreeProps) {
  const expandState = useSidebarExpandState();

  if (!expandState.isHydrated) {
    return null; // Avoid flash of incorrect expand state during SSR hydration
  }

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gray-400 mb-2">No pages yet</p>
        <p className="text-xs text-gray-300">
          Click &quot;New Page&quot; above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="py-1" role="tree" aria-label="Page tree">
      {tree.map((node) => (
        <SidebarTreeNode
          key={node.id}
          node={node}
          depth={0}
          isExpanded={expandState.isExpanded(node.id)}
          onToggle={expandState.toggle}
          expandState={expandState}
        />
      ))}
    </div>
  );
}
