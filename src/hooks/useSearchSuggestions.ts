"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";

interface Suggestion {
  pageId: string;
  title: string;
}

const SUGGESTION_DEBOUNCE = 150;

/**
 * Fetches search suggestions (page titles) as user types.
 *
 * Debounced to 150ms to provide quick feedback without overwhelming API.
 * Returns top 5 page titles matching the query.
 */
export function useSearchSuggestions(query: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, SUGGESTION_DEBOUNCE);

  useEffect(() => {
    if (!enabled || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`
        );
        if (response.ok && !cancelled) {
          const data = await response.json();
          setSuggestions(
            (data.data || []).map((r: { pageId: string; pageTitle: string }) => ({
              pageId: r.pageId,
              title: r.pageTitle,
            }))
          );
        }
      } catch {
        // Silently ignore errors
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, enabled]);

  return { suggestions, isLoading };
}
