export interface TextDiff {
  additions: number;
  deletions: number;
  changes: Array<{
    type: "add" | "remove" | "equal";
    value: string;
  }>;
}

/**
 * Compute a simple word-level diff between two texts.
 */
export function computeTextDiff(oldText: string, newText: string): TextDiff {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);

  const changes: TextDiff["changes"] = [];
  let additions = 0;
  let deletions = 0;

  let i = 0,
    j = 0;
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      changes.push({ type: "add", value: newWords[j] });
      additions++;
      j++;
    } else if (j >= newWords.length) {
      changes.push({ type: "remove", value: oldWords[i] });
      deletions++;
      i++;
    } else if (oldWords[i] === newWords[j]) {
      changes.push({ type: "equal", value: oldWords[i] });
      i++;
      j++;
    } else {
      changes.push({ type: "remove", value: oldWords[i] });
      deletions++;
      i++;
      changes.push({ type: "add", value: newWords[j] });
      additions++;
      j++;
    }
  }

  return { additions, deletions, changes };
}
