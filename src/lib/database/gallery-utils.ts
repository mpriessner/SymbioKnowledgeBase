/**
 * Generate a deterministic gradient from a string (title hash).
 */
export function titleToGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 60%, 85%), hsl(${(hue + 40) % 360}, 60%, 75%))`;
}

/**
 * Check if a URL is likely an image.
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/.test(path);
  } catch {
    return false;
  }
}
