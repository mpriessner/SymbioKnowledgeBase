export interface EmojiCategory {
  name: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys",
    emojis: [
      "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}", "\u{1F606}", "\u{1F605}", "\u{1F923}", "\u{1F602}", "\u{1F642}", "\u{1F60A}",
      "\u{1F607}", "\u{1F970}", "\u{1F60D}", "\u{1F929}", "\u{1F618}", "\u{1F60B}", "\u{1F61B}", "\u{1F61C}", "\u{1F92A}", "\u{1F61D}",
      "\u{1F917}", "\u{1F914}", "\u{1FAE1}", "\u{1F610}", "\u{1F611}", "\u{1F636}", "\u{1F644}", "\u{1F60F}", "\u{1F62C}", "\u{1F62E}\u200D\u{1F4A8}",
    ],
  },
  {
    name: "People",
    emojis: [
      "\u{1F44B}", "\u{1F91A}", "\u{1F590}", "\u270B", "\u{1F596}", "\u{1F44C}", "\u{1F90C}", "\u{1F90F}", "\u270C\uFE0F", "\u{1F91E}",
      "\u{1F91F}", "\u{1F918}", "\u{1F919}", "\u{1F448}", "\u{1F449}", "\u{1F446}", "\u{1F447}", "\u261D\uFE0F", "\u{1F44D}", "\u{1F44E}",
      "\u{1F44F}", "\u{1F64C}", "\u{1F91D}", "\u{1F64F}", "\u{1F4AA}", "\u{1F9E0}", "\u{1F440}", "\u{1F441}", "\u{1F464}", "\u{1F465}",
    ],
  },
  {
    name: "Nature",
    emojis: [
      "\u{1F331}", "\u{1F33F}", "\u{1F340}", "\u{1F335}", "\u{1F332}", "\u{1F333}", "\u{1F334}", "\u{1F338}", "\u{1F33A}", "\u{1F33B}",
      "\u{1F339}", "\u{1F337}", "\u{1F341}", "\u{1F342}", "\u{1F343}", "\u{1F30D}", "\u{1F30E}", "\u{1F30F}", "\u{1F308}", "\u2600\uFE0F",
      "\u{1F324}", "\u26C5", "\u{1F327}", "\u26C8", "\u{1F329}", "\u{1F30A}", "\u2744\uFE0F", "\u{1F525}", "\u2B50", "\u{1F319}",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "\u{1F4C4}", "\u{1F4DD}", "\u{1F4D6}", "\u{1F4DA}", "\u{1F4D3}", "\u{1F4D4}", "\u{1F4D2}", "\u{1F4D5}", "\u{1F4D7}", "\u{1F4D8}",
      "\u{1F4D9}", "\u{1F4F0}", "\u{1F5DE}", "\u{1F4D1}", "\u{1F516}", "\u{1F3F7}", "\u{1F4CC}", "\u{1F4CD}", "\u{1F4CE}", "\u{1F587}",
      "\u{1F4D0}", "\u{1F4CF}", "\u{1F5C2}", "\u{1F4C1}", "\u{1F4C2}", "\u{1F5C3}", "\u{1F5C4}", "\u{1F5D1}", "\u{1F512}", "\u{1F513}",
      "\u{1F511}", "\u{1F527}", "\u{1F528}", "\u2699\uFE0F", "\u{1F9F2}", "\u{1F52C}", "\u{1F52D}", "\u{1F4E1}", "\u{1F4A1}", "\u{1F50B}",
    ],
  },
  {
    name: "Symbols",
    emojis: [
      "\u2764\uFE0F", "\u{1F9E1}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}", "\u{1F5A4}", "\u{1F90D}", "\u{1F90E}", "\u{1F494}",
      "\u2757", "\u2753", "\u2B55", "\u274C", "\u2705", "\u2611\uFE0F", "\u2714\uFE0F", "\u2795", "\u2796", "\u2797",
      "\u{1F4AF}", "\u{1F534}", "\u{1F7E0}", "\u{1F7E1}", "\u{1F7E2}", "\u{1F535}", "\u{1F7E3}", "\u26AB", "\u26AA", "\u{1F536}",
      "\u25B6\uFE0F", "\u23F8", "\u23F9", "\u23FA", "\u23EF", "\u{1F500}", "\u{1F501}", "\u{1F502}", "\u{1F503}", "\u{1F504}",
    ],
  },
  {
    name: "Science",
    emojis: [
      "\u{1F9EA}", "\u{1F9EB}", "\u{1F9EC}", "\u{1F52C}", "\u{1F52D}", "\u{1F4CA}", "\u{1F4C8}", "\u{1F4C9}", "\u{1F9EE}", "\u{1F4BB}",
      "\u{1F5A5}", "\u{1F5A8}", "\u2328\uFE0F", "\u{1F5B1}", "\u{1F4BE}", "\u{1F4BF}", "\u{1F4C0}", "\u{1F5DC}", "\u{1F4DF}", "\u{1F4E0}",
      "\u{1F3E5}", "\u{1F3DB}", "\u{1F3EB}", "\u{1F3E2}", "\u{1F3ED}", "\u{1F3D7}", "\u{1F9F0}", "\u{1F6E0}", "\u2697\uFE0F", "\u{1FA7A}",
    ],
  },
  {
    name: "Food",
    emojis: [
      "\u{1F34E}", "\u{1F34A}", "\u{1F34B}", "\u{1F34C}", "\u{1F349}", "\u{1F347}", "\u{1F353}", "\u{1FAD0}", "\u{1F352}", "\u{1F351}",
      "\u{1F96D}", "\u{1F34D}", "\u{1F965}", "\u{1F95D}", "\u{1F345}", "\u{1F951}", "\u{1F33D}", "\u{1F955}", "\u{1F9C5}", "\u{1F9C4}",
      "\u2615", "\u{1F375}", "\u{1F9C3}", "\u{1F964}", "\u{1F37A}", "\u{1F377}", "\u{1F942}", "\u{1F378}", "\u{1F9C1}", "\u{1F370}",
    ],
  },
  {
    name: "Travel",
    emojis: [
      "\u{1F697}", "\u{1F695}", "\u{1F68C}", "\u{1F68E}", "\u{1F3CE}", "\u{1F693}", "\u{1F691}", "\u{1F692}", "\u2708\uFE0F", "\u{1F680}",
      "\u{1F6F8}", "\u{1F681}", "\u26F5", "\u{1F6A2}", "\u{1F5FA}", "\u{1F9ED}", "\u{1F3D4}", "\u26F0", "\u{1F30B}", "\u{1F3D5}",
      "\u{1F3D6}", "\u{1F3DC}", "\u{1F3DD}", "\u{1F3DE}", "\u{1F5FC}", "\u{1F5FD}", "\u{1F3F0}", "\u{1F3EF}", "\u{1F3AA}", "\u{1F3A2}",
    ],
  },
];

/**
 * Flat list of all emojis for search functionality.
 */
export const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);

/**
 * Simple emoji search — checks if the emoji is in the category name
 * or if it matches common associations.
 * For MVP, we use a basic approach. A full implementation would
 * use emoji metadata with keywords.
 */
export function searchEmojis(query: string): string[] {
  if (!query.trim()) return ALL_EMOJIS;

  const lower = query.toLowerCase();

  // Search by category name first
  const matchingCategories = EMOJI_CATEGORIES.filter((cat) =>
    cat.name.toLowerCase().includes(lower)
  );
  if (matchingCategories.length > 0) {
    return matchingCategories.flatMap((cat) => cat.emojis);
  }

  // Fallback: return all emojis (in a real app, we'd have keyword metadata)
  return ALL_EMOJIS;
}
