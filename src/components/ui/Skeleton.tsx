interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

export function Skeleton({
  className = "",
  width,
  height,
  rounded = "md",
}: SkeletonProps) {
  const roundedClass = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };

  return (
    <div
      className={`animate-pulse bg-[var(--bg-secondary)] ${roundedClass[rounded]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
