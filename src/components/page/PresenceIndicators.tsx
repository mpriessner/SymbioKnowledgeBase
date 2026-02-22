"use client";

import { usePresence } from "@/hooks/usePresence";

interface PresenceIndicatorsProps {
  pageId: string;
  isEditing?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const avatarColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function PresenceIndicators({
  pageId,
  isEditing = false,
}: PresenceIndicatorsProps) {
  const { activeUsers } = usePresence(pageId, isEditing);

  if (activeUsers.length === 0) return null;

  const visibleUsers = activeUsers.slice(0, 5);
  const overflowCount = Math.max(0, activeUsers.length - 5);
  const editingUsers = activeUsers.filter((u) => u.isEditing);

  return (
    <div className="flex items-center gap-2">
      {/* Avatar Stack */}
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => (
          <div
            key={user.userId}
            className={`relative flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-medium border-2 border-[var(--bg-primary)] ${getAvatarColor(
              user.userId
            )} ${user.isEditing ? "ring-2 ring-blue-400 animate-pulse" : ""}`}
            title={`${user.userName}${
              user.isEditing ? " (editing)" : " (viewing)"
            }`}
          >
            {getInitials(user.userName)}
            {user.isEditing && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5">
                <svg
                  className="w-2 h-2 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </div>
            )}
          </div>
        ))}
        {overflowCount > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] border-2 border-[var(--bg-primary)]">
            +{overflowCount}
          </div>
        )}
      </div>

      {/* Editing Indicator */}
      {editingUsers.length > 0 && (
        <span className="text-xs text-[var(--text-tertiary)]">
          {editingUsers[0].userName}
          {editingUsers.length > 1 &&
            ` and ${editingUsers.length - 1} other${
              editingUsers.length > 2 ? "s" : ""
            }`}{" "}
          editing
        </span>
      )}
    </div>
  );
}
