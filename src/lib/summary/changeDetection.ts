/**
 * Change detection for summary regeneration.
 *
 * Uses a fast approximate diff ratio to determine whether
 * page content has changed enough to warrant regenerating summaries.
 */

/**
 * Compute an approximate change ratio between two text strings.
 *
 * Returns a value between 0 (identical) and 1 (completely different).
 * Uses a sampling-based approach for performance — runs on every save
 * so full Levenshtein would be too expensive for large documents.
 */
export function approximateChangeRatio(
  oldText: string,
  newText: string
): number {
  if (oldText === newText) return 0;
  if (!oldText || !newText) return 1;

  const maxLen = Math.max(oldText.length, newText.length);
  const minLen = Math.min(oldText.length, newText.length);

  // Length difference contributes to ratio
  const lengthDiff = maxLen - minLen;

  // Sample character comparison
  let sampleDiffs = 0;
  const sampleSize = Math.min(minLen, 200);
  const step = Math.max(1, Math.floor(minLen / sampleSize));
  let sampleCount = 0;

  for (let i = 0; i < minLen; i += step) {
    if (oldText[i] !== newText[i]) sampleDiffs++;
    sampleCount++;
  }

  const sampleRatio = sampleCount > 0 ? sampleDiffs / sampleCount : 0;
  return Math.min(1, lengthDiff / maxLen + sampleRatio);
}

/**
 * Determine whether summary should be regenerated.
 *
 * Triggers regeneration if:
 * 1. The change ratio exceeds the threshold, OR
 * 2. The page has no existing summary (always generate for new content)
 */
export function shouldRegenerateSummary(
  changeRatio: number,
  currentOneLiner: string | null,
  threshold: number
): boolean {
  if (currentOneLiner === null) return true;
  return changeRatio > threshold;
}
