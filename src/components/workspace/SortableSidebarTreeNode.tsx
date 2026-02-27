"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, usePathname } from "next/navigation";
import { useCreatePage, useUpdatePage } from "@/hooks/usePages";
import { Tooltip } from "@/components/ui/Tooltip";
import { MoreHorizontal, Check } from "lucide-react";
import {
  PageContextMenu,
  usePageContextMenu,
} from "@/components/sidebar/PageContextMenu";
import type { PageTreeNode } from "@/types/page";
import type { MultiSelectProps } from "@/components/workspace/Sidebar";

interface DropPosition {
  type: "before" | "after" | "child";
}

interface SortableSidebarTreeNodeProps {
  node: PageTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (pageId: string) => void;
  expandState: {
    isExpanded: (pageId: string) => boolean;
    toggle: (pageId: string) => void;
  };
  activeId: string | null;
  overId: string | null;
  dropPosition: DropPosition | null;
  multiSelect?: MultiSelectProps;
}

export function SortableSidebarTreeNode({
  node,
  depth,
  isExpanded,
  onToggle,
  expandState,
  activeId,
  overId,
  dropPosition,
  multiSelect,
}: SortableSidebarTreeNodeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const [isHovered, setIsHovered] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.title);
  const titleRef = useRef<HTMLSpanElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = usePageContextMenu();

  const isNodeSelected = multiSelect?.isSelected(node.id) ?? false;
  const showCheckboxes = (multiSelect?.selectionCount ?? 0) > 0;

  // Check if title is truncated
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [node.title]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    data: {
      type: "page",
      node,
      depth,
      parentId: node.parentId,
    },
  });

  const isActive = pathname === `/pages/${node.id}`;
  const hasChildren = node.children.length > 0;
  const paddingLeft = 12 + depth * 16;
  const isDropTarget = overId === node.id && !isDragging;

  const rowStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: `${paddingLeft}px`,
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Let multi-select consume Cmd/Shift clicks
      if (multiSelect?.handleMultiSelectClick(node.id, e)) {
        return;
      }
      router.push(`/pages/${node.id}`);
    },
    [router, node.id, multiSelect]
  );

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
            if (!isExpanded) onToggle(node.id);
            router.push(`/pages/${data.data.id}`);
          },
        }
      );
    },
    [createPage, node.id, isExpanded, onToggle, router]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, node.id, node.title);
    },
    [openContextMenu, node.id, node.title]
  );

  const handleMoreClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openContextMenu(e, node.id, node.title);
    },
    [openContextMenu, node.id, node.title]
  );

  const handleStartRename = useCallback(() => {
    setRenameValue(node.title);
    setIsRenaming(true);
    // Focus the input after it renders
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [node.title]);

  const handleFinishRename = useCallback(() => {
    const newTitle = renameValue.trim() || "Untitled";
    setIsRenaming(false);
    if (newTitle !== node.title) {
      updatePage.mutate({ id: node.id, title: newTitle });
    }
  }, [renameValue, node.title, node.id, updatePage]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleFinishRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsRenaming(false);
        setRenameValue(node.title);
      }
    },
    [handleFinishRename, node.title]
  );

  const handleDuplicate = useCallback(() => {
    createPage.mutate(
      {
        title: `${node.title} (copy)`,
        parentId: node.parentId || undefined,
        icon: node.icon || undefined,
      },
      {
        onSuccess: (data) => {
          router.push(`/pages/${data.data.id}`);
        },
      }
    );
  }, [createPage, node.title, node.parentId, node.icon, router]);

  // Row background: selected > active > drop-target > default
  const rowBg = (() => {
    if (isNodeSelected) return "bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100";
    if (isActive) return "bg-blue-100 text-blue-900";
    return "hover:bg-gray-100 text-gray-700";
  })();

  return (
    <div>
      {/* Drop indicator line: before */}
      {isDropTarget && dropPosition?.type === "before" && (
        <div
          className="h-0.5 rounded-full bg-blue-500 mx-2"
          style={{ marginLeft: `${paddingLeft}px` }}
        />
      )}

      {/* Node row — setNodeRef scoped to just the row so collision detection
          measures against this single row, not the entire subtree */}
      <div
        ref={setNodeRef}
        style={rowStyle}
        className={`
          group flex items-center h-8 cursor-pointer rounded-md mx-1
          transition-colors duration-100
          ${isDragging ? "opacity-40" : ""}
          ${rowBg}
          ${isDropTarget && dropPosition?.type === "child" ? "bg-blue-100 ring-2 ring-blue-400 ring-inset" : ""}
        `}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isActive || isNodeSelected}
        aria-level={depth + 1}
      >
        {/* Checkbox (visible when any page is selected, or on hover) */}
        {(showCheckboxes || isHovered) ? (
          <button
            className={`
              flex-shrink-0 w-4 h-4 ml-0.5 mr-0.5 flex items-center justify-center rounded border transition-colors
              ${isNodeSelected
                ? "bg-blue-500 border-blue-500 text-white"
                : "border-gray-300 hover:border-gray-400 bg-transparent"
              }
            `}
            onClick={(e) => {
              e.stopPropagation();
              multiSelect?.handleMultiSelectClick(node.id, {
                ...e,
                metaKey: true,
                ctrlKey: false,
                shiftKey: false,
              } as React.MouseEvent);
            }}
            tabIndex={-1}
            aria-label={isNodeSelected ? `Deselect ${node.title}` : `Select ${node.title}`}
          >
            {isNodeSelected && <Check className="w-3 h-3" />}
          </button>
        ) : (
          /* Drag handle (visible on hover when no selection) */
          <button
            className={`
              flex-shrink-0 w-4 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing
              ${isHovered ? "opacity-100" : "opacity-0"}
              transition-opacity
            `}
            {...attributes}
            {...listeners}
            tabIndex={-1}
            aria-label={`Drag ${node.title}`}
          >
            <svg
              className="w-3 h-3 text-gray-400"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </button>
        )}

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

        {/* Page title with tooltip for truncated text, or inline rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={handleRenameKeyDown}
            className="flex-1 text-sm leading-none bg-white border border-blue-400 rounded px-1 py-0.5 outline-none min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Tooltip content={isTruncated ? node.title : ""} placement="right">
            <span ref={titleRef} className="flex-1 truncate text-sm leading-none">
              {node.title}
            </span>
          </Tooltip>
        )}

        {/* Action buttons — always right-aligned via ml-auto */}
        <div className="ml-auto flex items-center flex-shrink-0">
          <button
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 ${
              isHovered && !activeId ? "visible" : "invisible"
            }`}
            onClick={handleMoreClick}
            aria-label={`More options for ${node.title}`}
            title="More options"
            tabIndex={isHovered && !activeId ? 0 : -1}
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 mr-1 ${
              isHovered && !activeId ? "visible" : "invisible"
            }`}
            onClick={handleCreateChild}
            aria-label={`Create page inside ${node.title}`}
            title="Create subpage"
            tabIndex={isHovered && !activeId ? 0 : -1}
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
        </div>
      </div>

      {/* Drop indicator line: after */}
      {isDropTarget && dropPosition?.type === "after" && (
        <div
          className="h-0.5 rounded-full bg-blue-500 mx-2"
          style={{ marginLeft: `${paddingLeft}px` }}
        />
      )}

      {/* Recursive children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <SortableSidebarTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandState.isExpanded(child.id)}
              onToggle={expandState.toggle}
              expandState={expandState}
              activeId={activeId}
              overId={overId}
              dropPosition={dropPosition}
              multiSelect={multiSelect}
            />
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && contextMenu.pageId === node.id && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          pageTitle={contextMenu.pageTitle}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onRename={handleStartRename}
          onDuplicate={handleDuplicate}
          selectedIds={multiSelect?.selectedIds}
          selectionCount={multiSelect?.selectionCount ?? 0}
        />
      )}
    </div>
  );
}
