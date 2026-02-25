"use client";

import {
  usePageShares,
  useUpdateSharePermission,
  useRemoveShare,
} from "@/hooks/usePageShares";
import { PermissionDropdown } from "./PermissionDropdown";

interface ShareDialogMemberListProps {
  pageId: string;
  currentUserId?: string;
}

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function ShareDialogMemberList({
  pageId,
  currentUserId,
}: ShareDialogMemberListProps) {
  const { data, isLoading } = usePageShares(pageId);
  const updatePermission = useUpdateSharePermission(pageId);
  const removeShare = useRemoveShare(pageId);

  if (isLoading) {
    return (
      <div className="py-3 text-xs text-[var(--text-tertiary)]">Loading members...</div>
    );
  }

  const members = data?.data ?? [];

  return (
    <div className="mb-4 space-y-1 max-h-48 overflow-y-auto">
      {members.map((member) => {
        const isCurrentUser = member.user_id === currentUserId;
        const initial = (member.user_name || member.user_email || "?")
          .charAt(0)
          .toUpperCase();
        const hue = nameToHue(member.user_name || member.user_email);

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${hue + 30}, 70%, 45%))`,
              }}
            >
              {initial}
            </div>

            {/* Name & email */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[var(--text-primary)] truncate">
                {member.user_name}
                {isCurrentUser && (
                  <span className="text-[var(--text-tertiary)] ml-1">(You)</span>
                )}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] truncate">
                {member.user_email}
              </div>
            </div>

            {/* Permission dropdown */}
            <PermissionDropdown
              value={member.permission}
              onChange={(perm) => {
                if (!member.is_owner) {
                  updatePermission.mutate({
                    shareId: member.id,
                    permission: perm,
                  });
                }
              }}
              onRemove={
                !member.is_owner
                  ? () => removeShare.mutate(member.id)
                  : undefined
              }
              disabled={member.is_owner}
            />
          </div>
        );
      })}
    </div>
  );
}
