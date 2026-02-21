"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCreatePage } from "@/hooks/usePages";
import type { PageTreeNode } from "@/types/page";

interface SidebarTreeNodeProps {
  node: PageTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (pageId: string) => void;
  expandState: {
    isExpanded: (pageId: string) => boolean;
    toggle: (pageId: string) => void;
  };
}

export function SidebarTreeNode({
  node,
  depth,
  isExpanded,
  onToggle,
  expandState,
}: SidebarTreeNodeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const createPage = useCreatePage();
  const [isHovered, setIsHovered] = useState(false);

  const isActive = pathname === `/pages/${node.id}`;
  const hasChildren = node.children.length > 0;
  const paddingLeft = 12 + depth * 16;

  const handleClick = useCallback(() => {
    router.push(`/pages/${node.id}`);
  }, [router, node.id]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [onToggle, node.id]
  );

  const handleCreateChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      createPage.mutate(
        { title: "Untitled", parentId: node.id },
        {
          onSuccess: (data) => {
            // Expand this node to show the new child
            if (!isExpanded) {
              onToggle(node.id);
            }
            router.push(`/pages/${data.data.id}`);
          },
        }
      );
    },
    [createPage, node.id, isExpanded, onToggle, router]
  );

  return (
    <div>
      {/* Node row */}
      <div
        className={`
          group flex items-center h-8 cursor-pointer rounded-md mx-1
          transition-colors duration-100
          ${isActive ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100 text-gray-700"}
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isActive}
        aria-level={depth + 1}
      >
        {/* Expand/collapse chevron */}
        <button
          className={`
            flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
            transition-colors hover:bg-gray-200
            ${!hasChildren ? "invisible" : ""}
          `}
          onClick={handleToggle}
          tabIndex={-1}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Page icon */}
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-sm mr-1">
          {node.icon || (
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          )}
        </span>

        {/* Page title */}
        <span className="flex-1 truncate text-sm leading-none">{node.title}</span>

        {/* Create child button (visible on hover) */}
        {isHovered && (
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 mr-1"
            onClick={handleCreateChild}
            aria-label={`Create page inside ${node.title}`}
            title="Create subpage"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>

      {/* Recursive children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandState.isExpanded(child.id)}
              onToggle={expandState.toggle}
              expandState={expandState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
