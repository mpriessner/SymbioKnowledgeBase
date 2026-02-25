"use client";

interface WorkspaceAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-9 h-9 text-base",
} as const;

/**
 * Generate a deterministic hue from a string.
 */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function WorkspaceAvatar({
  name,
  size = "sm",
  className = "",
}: WorkspaceAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "W";
  const hue = nameToHue(name);

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-semibold text-white flex-shrink-0 ${SIZES[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 55%), hsl(${hue}, 60%, 42%))`,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
